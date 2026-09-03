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
  }), 400, 'invalid_event_type');
});

Deno.test('real webhook returns 401 for invalid HMAC without external calls', async () => {
  await assertRejection(await signedRequest(true, false), 401, 'invalid_signature');
});

Deno.test('real webhook returns 401 for a signed event from the wrong environment', async () => {
  await assertRejection(await signedRequest(false), 401, 'unexpected_environment');
});

// All resources below are synthetic. The fetch replacement forbids real network I/O.
const checkoutId = '20000000-0000-4000-8000-000000000001';
const observedAt = '2026-09-01T12:00:00Z';
type Scenario = {
  event?: string; resource?: string; omitEnvironment?: boolean;
  payment?: Record<string, unknown>; subscription?: Record<string, unknown>;
  uncorrelated?: boolean; failApply?: boolean; failFinish?: boolean;
};

async function withProviderMock(run: (send: (scenario?: Scenario) => Promise<Response>, writes: string[]) => Promise<void>) {
  const names = ['MERCADO_PAGO_WEBHOOK_SECRET','MERCADO_PAGO_LIVE_MODE','MERCADO_PAGO_ACCOUNT_MODE',
    'MERCADO_PAGO_ACCESS_TOKEN','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
  const values = [testSecret,'true','test','synthetic-token','https://database.invalid','synthetic-service-key'];
  const saved = names.map((name) => Deno.env.get(name));
  names.forEach((name,index) => Deno.env.set(name,values[index]));
  const fetchBefore = globalThis.fetch;
  const errorBefore = console.error;
  const writes: string[] = [];
  let scenario: Scenario = {};
  let processed = false;
  let busy = false;
  const reference = `kad_checkout:${checkoutId}`;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const path = url.pathname;
    const reply = (body: unknown, status = 200) => Response.json(body, { status });
    if (url.hostname === 'api.mercadopago.com') {
      if (path === '/users/me') return reply({ id: 100, tags: ['test_user'] });
      if (path.startsWith('/v1/payments/')) return reply({
        id: dataId, collector_id: 100, live_mode: true, external_reference: reference,
        status: 'approved', transaction_amount: 14.99, currency_id: 'BRL',
        date_approved: observedAt, date_last_updated: observedAt, ...scenario.payment,
      });
      if (path.startsWith('/preapproval/')) return reply({
        id: 'sub-1', collector_id: 100, external_reference: reference, status: 'authorized',
        last_modified: observedAt, auto_recurring: { transaction_amount: 14.99, currency_id: 'BRL' },
        ...scenario.subscription,
      });
      if (path.startsWith('/authorized_payments/')) return reply({
        id: 'invoice-1', preapproval_id: 'sub-1', external_reference: reference,
        transaction_amount: 14.99, currency_id: 'BRL', debit_date: observedAt,
        last_modified: observedAt, payment: { id: dataId, status: 'approved' },
      });
    }
    if (url.hostname === 'database.invalid') {
      const args = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      if (path.endsWith('/claim_payment_webhook')) {
        if (processed) return reply({ outcome: 'duplicate', token: null });
        if (busy) return reply({ outcome: 'busy', token: null });
        busy = true;
        return reply({ outcome: 'claimed', token: checkoutId });
      }
      if (path.endsWith('/finish_payment_webhook')) {
        if (scenario.failFinish && args.p_processed) return reply({ message: 'synthetic failure' }, 500);
        processed = args.p_processed;
        busy = false;
        return reply(true);
      }
      if (path.endsWith('/payment_checkout_sessions')) return reply(scenario.uncorrelated ? null : {
        id: checkoutId, provider_subscription_id: 'sub-1', amount_cents: 1499, currency: 'BRL',
      });
      if (path.endsWith('/apply_mercado_pago_payment')) {
        if (scenario.failApply) return reply({ message: 'synthetic failure' }, 500);
        writes.push(args.p_provider_payment_id);
        return reply(null);
      }
      if (path.endsWith('/sync_mercado_pago_subscription')) {
        writes.push('subscription'); return reply(null);
      }
    }
    throw new Error('Unexpected synthetic request');
  };
  console.error = () => {};
  try {
    await run(async (options = {}) => {
      scenario = options;
      const resource = options.resource ?? dataId;
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(testSecret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signed = await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`id:${resource};request-id:${requestId};ts:${timestamp};`));
      const hash = [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2,'0')).join('');
      return handler!(new Request(`https://example.invalid?data.id=${resource}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-request-id': requestId,
          'x-signature': `ts=${timestamp},v1=${hash}` },
        body: JSON.stringify({ type: options.event ?? 'payment', id: 'synthetic-event',
          ...(options.omitEnvironment ? {} : { live_mode: true }), data: { id: resource } }),
      }));
    }, writes);
  } finally {
    globalThis.fetch = fetchBefore; console.error = errorBefore;
    names.forEach((name,index) => saved[index] === undefined ? Deno.env.delete(name) : Deno.env.set(name,saved[index]!));
  }
}

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

Deno.test('real handler processes payment then explicitly acknowledges duplicate without another apply', async () => {
  await withProviderMock(async (send,writes) => {
    equal(await (await send()).json(), { ok: true, outcome: 'processed' });
    equal(await (await send()).json(), { ok: true, outcome: 'duplicate' });
    equal(writes,[dataId]);
  });
});

Deno.test('real handler recovers apply and finalization failures on retry', async () => {
  for (const failure of ['failApply','failFinish']) await withProviderMock(async (send,writes) => {
    const first = await send({ [failure]: true }); equal(first.status,500); await first.body?.cancel();
    equal(await (await send()).json(),{ ok: true, outcome: 'processed' });
    equal(writes.length,failure === 'failApply' ? 1 : 2); // Database credit idempotency is tested separately.
  });
});

Deno.test('uncorrelated webhook is retryable, not a false success', async () => {
  await withProviderMock(async (send,writes) => {
    const first = await send({ uncorrelated: true }); equal(first.status,503); await first.body?.cancel();
    equal(writes,[]);
    equal((await send()).status,200);
  });
});

Deno.test('authorized subscription can resolve missing environment only through its correlated payment', async () => {
  await withProviderMock(async (send,writes) => {
    equal((await send({ event: 'subscription_authorized_payment', resource: 'invoice-1', omitEnvironment: true })).status,200);
    equal(writes,[dataId]);
  });
});

Deno.test('preapproval without trustworthy environment remains rejected; never assume test or production', async () => {
  await withProviderMock(async (send,writes) => {
    equal((await send({ event: 'subscription_preapproval',resource: 'sub-1',omitEnvironment: true })).status,401);
    equal(writes,[]);
  });
});

Deno.test('preapproval with explicit environment synchronizes a correlated subscription', async () => {
  await withProviderMock(async (send,writes) => {
    equal((await send({ event: 'subscription_preapproval',resource: 'sub-1' })).status,200);
    equal(writes,['subscription']);
  });
});

Deno.test('wrong resource, seller, and provider environment never apply credit', async () => {
  for (const [payment,status] of [[{ id: 'other' },500],[{ collector_id: 999 },500],[{ live_mode: false },401]] as const) {
    await withProviderMock(async (send,writes) => {
      equal((await send({ payment })).status,status); equal(writes,[]);
    });
  }
});

Deno.test('real handler rejects GET', async () => {
  equal((await handler!(new Request('https://example.invalid'))).status,405);
});
