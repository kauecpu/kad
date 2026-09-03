// Execute with: deno test --allow-env supabase/functions/mercado-pago-webhook/index.test.ts
// The real handler is captured without opening a server or reaching any database/API.
let handler: ((request: Request) => Promise<Response>) | undefined;
const originalServe = Object.getOwnPropertyDescriptor(Deno, 'serve')!;
Object.defineProperty(Deno, 'serve', {
  configurable: true,
  value: (callback: (request: Request) => Promise<Response>) => { handler = callback; },
});
try {
  await import('./index.ts');
} finally {
  Object.defineProperty(Deno, 'serve', originalServe);
}

const testSecret = 'synthetic-unit-test-only';
const requestId = 'local-negative-test';
const dataId = 'local-resource';
const timestamp = '1700000000';

async function signedRequest(liveMode: boolean, validSignature = true) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(testSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`id:${dataId};request-id:${requestId};ts:${timestamp};`));
  const hash = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return new Request(`https://example.invalid/webhook?data.id=${dataId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
      'x-signature': `ts=${timestamp},v1=${validSignature ? hash : '0'.repeat(64)}`,
    },
    body: JSON.stringify({ type: 'payment', live_mode: liveMode, data: { id: dataId } }),
  });
}

async function assertRejection(request: Request, expectedStatus: number, category: string) {
  const savedSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');
  const savedMode = Deno.env.get('MERCADO_PAGO_LIVE_MODE');
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logged: unknown[][] = [];
  Deno.env.set('MERCADO_PAGO_WEBHOOK_SECRET', testSecret);
  Deno.env.set('MERCADO_PAGO_LIVE_MODE', 'true');
  globalThis.fetch = () => { throw new Error('Negative webhook must not call an external service'); };
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    if (!handler) throw new Error('Webhook handler was not registered');
    const response = await handler(request);
    if (response.status !== expectedStatus) throw new Error(`Expected ${expectedStatus}, got ${response.status}`);
    const detail = logged[0]?.[1] as { category?: unknown } | undefined;
    if (detail?.category !== category) throw new Error(`Expected rejection category ${category}`);
    await response.body?.cancel();
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (savedSecret === undefined) Deno.env.delete('MERCADO_PAGO_WEBHOOK_SECRET');
    else Deno.env.set('MERCADO_PAGO_WEBHOOK_SECRET', savedSecret);
    if (savedMode === undefined) Deno.env.delete('MERCADO_PAGO_LIVE_MODE');
    else Deno.env.set('MERCADO_PAGO_LIVE_MODE', savedMode);
  }
}

Deno.test('real webhook returns 400 for invalid body without financial writes', async () => {
  await assertRejection(new Request('https://example.invalid/webhook', {
    method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
  }), 400, 'invalid_webhook');
});

Deno.test('real webhook returns 401 for invalid HMAC without external calls', async () => {
  await assertRejection(await signedRequest(true, false), 401, 'invalid_signature');
});

Deno.test('real webhook returns 401 for a signed event from the wrong environment', async () => {
  await assertRejection(await signedRequest(false), 401, 'unexpected_environment');
});
