import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authEmailIdempotencyKey,
  createResendEmailTransport,
  type OutboundAuthEmail,
  ResendTransportError,
} from '../supabase/functions/_shared/resend-email.ts';

const outboundEmail: OutboundAuthEmail = {
  actionType: 'signup',
  recipientRole: 'primary',
  to: 'pessoa@exemplo.com',
  subject: 'Marca de Teste: confirme seu e-mail',
  html: '<!doctype html><html><body>305805</body></html>',
  text: 'Seu código: 305805',
};

async function sendWithStatus(
  status: number,
  providerName = 'provider_error'
): Promise<{ id: string }> {
  const transport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    fetchImpl: async () => Response.json(
      status >= 200 && status < 300
        ? { id: 'email_123' }
        : { name: providerName, message: 'must not escape the adapter' },
      { status }
    ),
  });
  return transport.send(outboundEmail, 'auth/signup/primary/msg_auth_001');
}

function errorMatches(kind: 'transient' | 'permanent'): (error: unknown) => boolean {
  return (error: unknown) => error instanceof ResendTransportError && error.kind === kind;
}

test('envia corpo, remetente e idempotência sem expor a chave', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const transport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    replyTo: 'suporte@exemplo.com',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ id: 'email_123' }, { status: 200 });
    },
  });

  const result = await transport.send(outboundEmail, 'auth/signup/primary/msg_auth_001');

  assert.equal(result.id, 'email_123');
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init?.method, 'POST');
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get('Authorization'), 'Bearer re_private_test');
  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.equal(headers.get('Idempotency-Key'), 'auth/signup/primary/msg_auth_001');
  assert.equal(headers.get('User-Agent'), 'auth-email-hook/1.0');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    from: 'Marca de Teste <conta@email.exemplo.com>',
    to: ['pessoa@exemplo.com'],
    subject: 'Marca de Teste: confirme seu e-mail',
    html: '<!doctype html><html><body>305805</body></html>',
    text: 'Seu código: 305805',
    reply_to: 'suporte@exemplo.com',
    tags: [
      { name: 'auth_event', value: 'signup' },
      { name: 'recipient_role', value: 'primary' },
    ],
  });
  assert.doesNotMatch(JSON.stringify(await result), /re_private_test/);
});

test('omita reply-to e mantém html e texto juntos', async () => {
  let body: Record<string, unknown> | undefined;
  const transport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    fetchImpl: async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ id: 'email_123' }, { status: 200 });
    },
  });

  await transport.send(outboundEmail, 'auth/signup/primary/msg_auth_001');

  assert.equal(Object.hasOwn(body!, 'reply_to'), false);
  assert.equal(body!.html, '<!doctype html><html><body>305805</body></html>');
  assert.equal(body!.text, 'Seu código: 305805');
});

test('usa tags ASCII seguras derivadas somente do evento e papel', async () => {
  let tags: unknown;
  const transport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    fetchImpl: async (_url, init) => {
      tags = JSON.parse(String(init?.body)).tags;
      return Response.json({ id: 'email_123' }, { status: 200 });
    },
  });

  await transport.send({ ...outboundEmail, actionType: 'email_changed_notification', recipientRole: 'new_email' }, 'auth/email_changed_notification/new_email/msg_auth_001');

  assert.deepEqual(tags, [
    { name: 'auth_event', value: 'email_changed_notification' },
    { name: 'recipient_role', value: 'new_email' },
  ]);
  for (const tag of tags as Array<{ name: string; value: string }>) {
    assert.match(tag.name, /^[a-z0-9_-]+$/);
    assert.match(tag.value, /^[a-z0-9_-]+$/);
  }
});

test('classifica somente falhas seguramente repetíveis como transitórias', async () => {
  for (const status of [429, 500, 503]) {
    await assert.rejects(sendWithStatus(status), errorMatches('transient'));
  }
  for (const status of [400, 401, 403, 404, 422]) {
    await assert.rejects(sendWithStatus(status), errorMatches('permanent'));
  }
  await assert.rejects(sendWithStatus(409, 'concurrent_idempotent_requests'), errorMatches('transient'));
  await assert.rejects(sendWithStatus(409, 'invalid_idempotent_request'), errorMatches('permanent'));
  await assert.rejects(sendWithStatus(409, 'unknown_conflict'), errorMatches('permanent'));
});

test('classifica exceções de rede e abort como transitórias e limpa o timer', async () => {
  const networkTransport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    fetchImpl: async () => { throw new Error('network detail must not escape'); },
  });
  await assert.rejects(
    networkTransport.send(outboundEmail, 'auth/signup/primary/msg_auth_001'),
    (error: unknown) => errorMatches('transient')(error) && !String(error).includes('network detail must not escape')
  );

  let signal: AbortSignal | undefined;
  const abortTransport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    timeoutMs: 1,
    fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }),
  });
  await assert.rejects(abortTransport.send(outboundEmail, 'auth/signup/primary/msg_auth_001'), errorMatches('transient'));
  assert.equal(signal?.aborted, true);

  let completedSignal: AbortSignal | undefined;
  const completeTransport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    timeoutMs: 1,
    fetchImpl: async (_url, init) => {
      completedSignal = init?.signal ?? undefined;
      return Response.json({ id: 'email_123' }, { status: 200 });
    },
  });
  await completeTransport.send(outboundEmail, 'auth/signup/primary/msg_auth_001');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(completedSignal?.aborted, false);
});

test('trata respostas de sucesso inválidas como permanentes', async () => {
  for (const response of [
    Response.json({}, { status: 200 }),
    Response.json({ id: '' }, { status: 200 }),
    Response.json({ id: 'email.dot' }, { status: 200 }),
    new Response('not json', { status: 200 }),
  ]) {
    const transport = createResendEmailTransport({
      apiKey: 're_private_test',
      from: 'Marca de Teste <conta@email.exemplo.com>',
      fetchImpl: async () => response.clone(),
    });
    await assert.rejects(transport.send(outboundEmail, 'auth/signup/primary/msg_auth_001'), errorMatches('permanent'));
  }
});

test('cria chave idempotente limitada, sem PII e recusa entradas perigosas', () => {
  assert.equal(
    authEmailIdempotencyKey({ webhookId: 'msg_auth-001_2', actionType: 'signup', recipientRole: 'primary' }),
    'auth/signup/primary/msg_auth-001_2'
  );
  const maximumWebhookId = 'a'.repeat(128);
  assert.ok(authEmailIdempotencyKey({ webhookId: maximumWebhookId, actionType: 'email_changed_notification', recipientRole: 'current_email' }).length <= 256);
  for (const webhookId of ['', 'id.with.dot', 'id\ncontrol', 'x'.repeat(129)]) {
    assert.throws(() => authEmailIdempotencyKey({ webhookId, actionType: 'signup', recipientRole: 'primary' }), /invalid_idempotency_key/);
  }
});

test('recusa chave com mais de 256 caracteres sem chamar a API', async () => {
  let calls = 0;
  const transport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ id: 'email_123' }, { status: 200 });
    },
  });

  await assert.rejects(transport.send(outboundEmail, 'a'.repeat(257)), errorMatches('permanent'));
  assert.equal(calls, 0);
});

test('recusa chave de transporte que não segue o formato seguro sem chamar a API', async () => {
  let calls = 0;
  const transport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ id: 'email_123' }, { status: 200 });
    },
  });

  for (const key of [
    'auth/signup/primary/id.with.dot',
    'auth/signup/primary/id\ncontrol',
    'auth/recovery/primary/msg_auth_001',
  ]) {
    await assert.rejects(transport.send(outboundEmail, key), errorMatches('permanent'));
  }
  assert.equal(calls, 0);
});

test('remove conteúdo do provedor dos erros expostos', async () => {
  const transport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    fetchImpl: async () => Response.json({
      name: 'invalid_idempotent_request',
      message: 'provider detail pessoa@exemplo.com re_private_test 305805',
      extra: '<html>private body</html>',
    }, { status: 409 }),
  });

  await assert.rejects(
    transport.send(outboundEmail, 'auth/signup/primary/msg_auth_001'),
    (error: unknown) => error instanceof ResendTransportError &&
      error.kind === 'permanent' &&
      error.providerCode === 'invalid_idempotent_request' &&
      !/pessoa@exemplo\.com|re_private_test|305805|private body|provider detail/.test(String(error))
  );
});
