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
  TEST_WEBHOOK_ID,
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

test('mapeia falha permanente do transporte para 502', async () => {
  handler = makeHandler({
    createTransport: () => ({
      async send() { throw new ResendTransportError('permanent', 422, 'provider_error'); },
    }),
  });
  const response = await handler(signedRequest(authEmailPayload('signup')));
  assert.equal(response.status, 502);
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
  assert.deepEqual(await responseBody(response), { error: 'provider_transient_error' });
});

test('envia mudança segura de e-mail em ordem current/new com chaves distintas', async () => {
  const response = await handler(signedRequest(authEmailPayload('email_change')));
  assert.equal(response.status, 200);
  assert.deepEqual(sent.map(({ message, idempotencyKey }) => ({
    to: message.to,
    recipientRole: message.recipientRole,
    idempotencyKey,
  })), [
    {
      to: 'pessoa@exemplo.com',
      recipientRole: 'current_email',
      idempotencyKey: `auth/email_change/current_email/${TEST_WEBHOOK_ID}`,
    },
    {
      to: 'novo@exemplo.com',
      recipientRole: 'new_email',
      idempotencyKey: `auth/email_change/new_email/${TEST_WEBHOOK_ID}`,
    },
  ]);
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

test('rejeita webhook-id que não pode compor a chave de idempotência', async () => {
  const response = await handler(signedRequest(authEmailPayload('signup'), { webhookId: 'unsafe.id' }));
  assert.equal(response.status, 422);
  assert.deepEqual(await responseBody(response), { error: 'invalid_payload' });
  assert.equal(sent.length, 0);
});
