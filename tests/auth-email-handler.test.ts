import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import {
  AuthEmailConfigurationError,
  type AuthEmailRuntimeConfig,
} from '../supabase/functions/_shared/auth-email-config.ts';
import type { AuthEmailHandlerDependencies, AuthEmailLogEntry } from '../supabase/functions/_shared/auth-email-handler.ts';
import { createAuthEmailHandler } from '../supabase/functions/_shared/auth-email-handler.ts';
import { AuthEmailSignatureError, verifyAuthEmailHook } from '../supabase/functions/_shared/auth-email-signature.ts';
import {
  type EmailTransport,
  type OutboundAuthEmail,
  ResendTransportError,
} from '../supabase/functions/_shared/resend-email.ts';
import {
  authEmailPayload,
  signedAuthEmailRequest,
  TEST_AUTH_EMAIL_CONFIG,
  TEST_HOOK_SECRET,
} from './auth-email-fixtures.ts';

const endpoint = 'http://localhost/functions/v1/send-auth-email';
const sent: Array<{ message: OutboundAuthEmail; idempotencyKey: string }> = [];
const logs: AuthEmailLogEntry[] = [];

const transport: EmailTransport = {
  async send(message, idempotencyKey) {
    sent.push({ message, idempotencyKey });
    return { id: `email_${sent.length}` };
  },
};

function makeHandler(
  overrides: Partial<AuthEmailHandlerDependencies> = {}
): ReturnType<typeof createAuthEmailHandler> {
  return createAuthEmailHandler({
    loadConfig: () => TEST_AUTH_EMAIL_CONFIG,
    verifyHook: verifyAuthEmailHook,
    createTransport: () => transport,
    logger: (entry) => logs.push(entry),
    now: () => 100,
    ...overrides,
  });
}

let handler = makeHandler();

function requestWith(input: {
  method?: string;
  body?: string;
  headers?: HeadersInit;
} = {}): Request {
  const method = input.method ?? 'POST';
  return new Request(endpoint, {
    method,
    headers: input.headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : (input.body ?? ''),
  });
}

const signedRequest = (
  payloadOrRawBody: unknown | string,
  options?: Parameters<typeof signedAuthEmailRequest>[1]
) => signedAuthEmailRequest(payloadOrRawBody, options);

const unknownPayload = {
  ...authEmailPayload('signup'),
  email_data: {
    ...authEmailPayload('signup').email_data,
    email_action_type: 'future_event',
  },
};

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

function requestWithStream(stream: ReadableStream<Uint8Array>, headers?: HeadersInit): Request {
  return new Request(endpoint, {
    method: 'POST',
    headers,
    body: stream as unknown as BodyInit,
    duplex: 'half',
  } as RequestInit);
}

beforeEach(() => {
  sent.length = 0;
  logs.length = 0;
  handler = makeHandler();
});

const cases = [
  { name: 'método', request: () => requestWith({ method: 'GET' }), status: 405 },
  { name: 'assinatura ausente', request: () => requestWith({ headers: {} }), status: 401 },
  { name: 'corpo excessivo', request: () => requestWith({ body: 'x'.repeat(65_537) }), status: 413 },
  { name: 'json assinado inválido', request: () => signedRequest('{'), status: 422 },
  { name: 'evento desconhecido', request: () => signedRequest(unknownPayload), status: 422 },
];

for (const item of cases) {
  test(`retorna ${item.status} para ${item.name}`, async () => {
    const response = await handler(item.request());
    assert.equal(response.status, item.status);
  });
}

test('declara POST como único método permitido', async () => {
  const response = await handler(requestWith({ method: 'GET' }));
  assert.equal(response.headers.get('Allow'), 'POST');
  assert.deepEqual(await responseBody(response), { error: 'method_not_allowed' });
});

test('rejeita Content-Length acima do limite antes de verificar o hook', async () => {
  let verified = 0;
  handler = makeHandler({ verifyHook: () => { verified += 1; return {}; } });
  const response = await handler(requestWith({
    body: 'x'.repeat(65_537),
    headers: { 'content-length': '65537' },
  }));
  assert.equal(response.status, 413);
  assert.equal(verified, 0);
});

test('rejeita stream que cruza 64 KiB e cancela antes de verificar o hook', async () => {
  let verified = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(65_536));
      controller.enqueue(new Uint8Array([1]));
    },
    cancel() { cancelled = true; },
  });
  handler = makeHandler({ verifyHook: () => { verified += 1; return {}; } });
  const response = await handler(requestWithStream(stream));
  assert.equal(response.status, 413);
  assert.equal(verified, 0);
  assert.equal(cancelled, true);
});

test('rejeita UTF-8 inválido antes de verificar ou enviar', async () => {
  let verified = 0;
  handler = makeHandler({ verifyHook: () => { verified += 1; return {}; } });
  const response = await handler(requestWithStream(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0xc3, 0x28]));
      controller.close();
    },
  })));
  assert.equal(response.status, 422);
  assert.deepEqual(await responseBody(response), { error: 'invalid_payload' });
  assert.equal(verified, 0);
  assert.equal(sent.length, 0);
});

test('preserva BOM assinado e depois classifica o JSON inválido sem enviar', async () => {
  const response = await handler(signedRequest('\uFEFF{'));
  assert.equal(response.status, 422);
  assert.deepEqual(await responseBody(response), { error: 'invalid_payload' });
  assert.equal(sent.length, 0);
});

test('não interpreta nem envia um corpo cuja assinatura é inválida', async () => {
  let transportCreated = 0;
  handler = makeHandler({
    verifyHook: () => { throw new AuthEmailSignatureError(); },
    createTransport: () => { transportCreated += 1; return transport; },
  });
  const response = await handler(requestWith({ body: '{' }));
  assert.equal(response.status, 401);
  assert.deepEqual(await responseBody(response), { error: 'invalid_signature' });
  assert.equal(transportCreated, 0);
  assert.equal(sent.length, 0);
});

test('registra somente nomes de variáveis permitidos para erro de configuração', async () => {
  handler = makeHandler({
    loadConfig: () => { throw new AuthEmailConfigurationError(['RESEND_API_KEY', 'SEND_EMAIL_HOOK_SECRET']); },
  });
  const response = await handler(signedRequest(authEmailPayload('signup')));
  assert.equal(response.status, 500);
  assert.deepEqual(await responseBody(response), { error: 'configuration_error' });
  assert.deepEqual(logs, [{
    event: 'auth_email_failed',
    errorCode: 'configuration_error',
    invalidConfigNames: ['RESEND_API_KEY', 'SEND_EMAIL_HOOK_SECRET'],
    durationMs: 0,
  }]);
});

test('retorna sucesso vazio somente após aceitação do Resend', async () => {
  const response = await handler(signedRequest(authEmailPayload('signup')));
  assert.equal(response.status, 200);
  assert.deepEqual(await responseBody(response), {});
  assert.equal(sent.length, 1);
  assert.equal(logs[0]?.event, 'auth_email_succeeded');
  assert.deepEqual(logs[0]?.acceptedEmailIds, ['email_1']);
});

test('envia alerta de e-mail alterado somente ao endereço anterior assinado', async () => {
  const response = await handler(signedRequest(authEmailPayload('email_changed_notification', {
    user: { email: 'novo-controlado@atacante.example' },
    email_data: { old_email: 'titular-anterior@vitima.example' },
  })));

  assert.equal(response.status, 200);
  assert.deepEqual(sent.map(({ message }) => message.to), [
    'titular-anterior@vitima.example',
  ]);
});

test('falha fechado para identity unlink sem destinatário vinculável', async () => {
  let transportCreated = 0;
  handler = makeHandler({
    createTransport: () => {
      transportCreated += 1;
      return transport;
    },
  });

  const response = await handler(signedRequest(authEmailPayload('identity_unlinked_notification', {
    user: { email: 'endereco-promovido@atacante.example' },
  })));

  assert.equal(response.status, 422);
  assert.deepEqual(await responseBody(response), { error: 'unsupported_action' });
  assert.equal(transportCreated, 0);
  assert.equal(sent.length, 0);
});

test('preserva o envio de notificação com destinatário vinculável', async () => {
  const response = await handler(signedRequest(authEmailPayload('password_changed_notification')));

  assert.equal(response.status, 200);
  assert.deepEqual(sent.map(({ message }) => ({
    actionType: message.actionType,
    to: message.to,
  })), [{
    actionType: 'password_changed_notification',
    to: 'pessoa@exemplo.com',
  }]);
});

test('mapeia falha permanente do transporte para 502', async () => {
  handler = makeHandler({
    createTransport: () => ({
      async send() { throw new ResendTransportError('permanent', 422, 'provider_error'); },
    }),
  });
  const response = await handler(signedRequest(authEmailPayload('signup')));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Retry-After'), null);
  assert.deepEqual(await responseBody(response), { error: 'provider_permanent_error' });
});

test('mapeia falha transitória do transporte para 503', async () => {
  handler = makeHandler({
    createTransport: () => ({
      async send() { throw new ResendTransportError('transient', 503, 'provider_error'); },
    }),
  });
  const response = await handler(signedRequest(authEmailPayload('signup')));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '1');
  assert.deepEqual(await responseBody(response), { error: 'provider_transient_error' });
});

test('envia mudança segura de e-mail em ordem current/new com chaves distintas', async () => {
  const response = await handler(signedRequest(authEmailPayload('email_change')));
  assert.equal(response.status, 200);
  const deliveries = sent.map(({ message, idempotencyKey }) => ({
    to: message.to,
    recipientRole: message.recipientRole,
    idempotencyKey,
  }));
  assert.deepEqual(deliveries.map(({ to, recipientRole }) => ({ to, recipientRole })), [
    { to: 'pessoa@exemplo.com', recipientRole: 'current_email' },
    { to: 'novo@exemplo.com', recipientRole: 'new_email' },
  ]);
  assert.match(deliveries[0].idempotencyKey, /^auth\/email_change\/current_email\/[a-f0-9]{64}$/);
  assert.match(deliveries[1].idempotencyKey, /^auth\/email_change\/new_email\/[a-f0-9]{64}$/);
  assert.equal(
    deliveries[0].idempotencyKey.split('/')[3],
    deliveries[1].idempotencyKey.split('/')[3]
  );
});

test('reutiliza a chave para o mesmo corpo assinado mesmo com novo webhook-id', async () => {
  const rawBody = JSON.stringify(authEmailPayload('signup'));
  const first = await handler(signedRequest(rawBody, { webhookId: 'msg_retry_001' }));
  const second = await handler(signedRequest(rawBody, { webhookId: 'msg_retry_002' }));

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey);
  assert.match(sent[0].idempotencyKey, /^auth\/signup\/primary\/[a-f0-9]{64}$/);
  assert.notEqual(logs[0].webhookId, logs[1].webhookId);
});

test('separa chaves quando metadata.uuid muda no corpo assinado', async () => {
  const firstPayload = {
    ...authEmailPayload('signup'),
    metadata: {
      uuid: 'metadata-uuid-001',
      time: '2026-08-14T00:00:00Z',
    },
  };
  const secondPayload = {
    ...authEmailPayload('signup'),
    metadata: {
      uuid: 'metadata-uuid-002',
      time: '2026-08-14T00:00:01Z',
    },
  };

  const first = await handler(signedRequest(firstPayload, { webhookId: 'msg_same_001' }));
  const second = await handler(signedRequest(secondPayload, { webhookId: 'msg_same_001' }));

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.notEqual(sent[0].idempotencyKey, sent[1].idempotencyKey);
});

test('replay de aceite parcial reutiliza a chave da primeira mensagem', async () => {
  const firstMessageKeys: string[] = [];
  handler = makeHandler({
    createTransport: () => {
      let call = 0;
      return {
        async send(_message, idempotencyKey) {
          call += 1;
          if (call === 1) {
            firstMessageKeys.push(idempotencyKey);
            return { id: 'email_safe_1' };
          }
          throw new ResendTransportError('transient', 503, 'provider_error');
        },
      };
    },
  });
  const rawBody = JSON.stringify(authEmailPayload('email_change'));

  const first = await handler(signedRequest(rawBody, { webhookId: 'msg_partial_001' }));
  const replay = await handler(signedRequest(rawBody, { webhookId: 'msg_partial_002' }));

  assert.equal(first.status, 503);
  assert.equal(replay.status, 503);
  assert.equal(first.headers.get('Retry-After'), '1');
  assert.equal(replay.headers.get('Retry-After'), '1');
  assert.equal(firstMessageKeys.length, 2);
  assert.equal(firstMessageKeys[0], firstMessageKeys[1]);
});

test('classifica aceite parcial como transitório e registra somente IDs aceitos', async () => {
  let calls = 0;
  handler = makeHandler({
    createTransport: () => ({
      async send() {
        calls += 1;
        if (calls === 1) return { id: 'email_safe_1' };
        throw new ResendTransportError('transient', 503, 'provider_error');
      },
    }),
  });
  const response = await handler(signedRequest(authEmailPayload('email_change')));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '1');
  assert.deepEqual(await responseBody(response), { error: 'provider_transient_error' });
  assert.deepEqual(logs[0]?.acceptedEmailIds, ['email_safe_1']);
});

test('retorna 503 após aceite parcial mesmo quando a segunda falha é permanente', async () => {
  let calls = 0;
  handler = makeHandler({
    createTransport: () => ({
      async send() {
        calls += 1;
        if (calls === 1) return { id: 'email_safe_1' };
        throw new ResendTransportError('permanent', 422, 'provider_error');
      },
    }),
  });
  const response = await handler(signedRequest(authEmailPayload('email_change')));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '1');
  assert.deepEqual(await responseBody(response), { error: 'provider_transient_error' });
  assert.deepEqual(logs[0]?.acceptedEmailIds, ['email_safe_1']);
});

test('retorna 503 após aceite parcial quando a segunda entrega lança erro genérico', async () => {
  let calls = 0;
  handler = makeHandler({
    createTransport: () => ({
      async send() {
        calls += 1;
        if (calls === 1) return { id: 'email_safe_1' };
        throw new Error('provider detail must not escape');
      },
    }),
  });
  const response = await handler(signedRequest(authEmailPayload('email_change')));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '1');
  assert.deepEqual(await responseBody(response), { error: 'provider_transient_error' });
  assert.deepEqual(logs[0]?.acceptedEmailIds, ['email_safe_1']);
});

test('retorna 503 após aceite parcial quando a segunda entrega retorna ID inválido', async () => {
  let calls = 0;
  handler = makeHandler({
    createTransport: () => ({
      async send() {
        calls += 1;
        return { id: calls === 1 ? 'email_safe_1' : 'unsafe.id' };
      },
    }),
  });
  const response = await handler(signedRequest(authEmailPayload('email_change')));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '1');
  assert.deepEqual(await responseBody(response), { error: 'provider_transient_error' });
  assert.deepEqual(logs[0]?.acceptedEmailIds, ['email_safe_1']);
});

test('não vaza dados sensíveis nos logs nem em respostas públicas', async () => {
  const response = await handler(signedRequest(authEmailPayload('magiclink')));
  const serialised = JSON.stringify({ logs, body: await responseBody(response) });
  for (const secret of [
    'pessoa@exemplo.com',
    '305805',
    'hash-do-endereco-novo',
    'kad://',
    '<html',
    TEST_AUTH_EMAIL_CONFIG.resendApiKey,
    TEST_HOOK_SECRET,
  ]) {
    assert.doesNotMatch(serialised, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.deepEqual(await (async () => {
    const error = await makeHandler({ createTransport: () => ({ async send() { throw new Error('details'); } }) })(signedRequest(authEmailPayload('signup')));
    return responseBody(error);
  })(), { error: 'internal_error' });
});

test('rejeita webhook-id inseguro antes de registrar o identificador', async () => {
  const response = await handler(signedRequest(authEmailPayload('signup'), { webhookId: 'unsafe.id' }));
  assert.equal(response.status, 422);
  assert.deepEqual(await responseBody(response), { error: 'invalid_payload' });
  assert.equal(sent.length, 0);
});
