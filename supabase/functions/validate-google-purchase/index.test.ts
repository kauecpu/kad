type Handler = (request: Request) => Promise<Response>;
let handler: Handler;
const serve = Object.getOwnPropertyDescriptor(Deno, 'serve')!;
Object.defineProperty(Deno, 'serve', { configurable: true, value: (value: Handler) => { handler = value; } });
try { await import('./index.ts'); } finally { Object.defineProperty(Deno, 'serve', serve); }
function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message); }

// Disposable key generated only for the local OAuth fixture; no Google credentials.
const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const key = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keys.privateKey));
const account = JSON.stringify({ client_email: 'fixture@example.invalid',
  private_key: `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...key))}\n-----END PRIVATE KEY-----` });
const userId = '10000000-0000-4000-8000-000000000001';
const cases: [string, number, boolean?][] = [
  ['ACTIVE', 200, true], ['IN_GRACE_PERIOD', 200, true], ['CANCELED', 200, true],
  ['ON_HOLD', 200, false], ['PAUSED', 200, false], ['EXPIRED', 200, false],
  ['UNSPECIFIED', 200, false], ['FUTURE_UNKNOWN', 200, false], ['expired-date', 200, false],
  ['PENDING', 409], ['invalid-token', 422], ['product-mismatch', 422], ['other-owner', 422],
  ['network-failure', 502], ['missing-auth', 401], ['invalid-auth', 401], ['not-configured', 500],
];

for (const [scenario, status, entitlement] of cases) {
  Deno.test(`Google HTTP fixture: ${scenario}`, async () => {
    const names = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_PLAY_PACKAGE_NAME', 'GOOGLE_SERVICE_ACCOUNT_JSON'];
    const previous = names.map(name => Deno.env.get(name));
    names.forEach(name => Deno.env.set(name, name === 'SUPABASE_URL' ? 'https://database.invalid'
      : name === 'GOOGLE_SERVICE_ACCOUNT_JSON' ? account : 'synthetic-only'));
    if (['missing-auth', 'invalid-auth', 'not-configured'].includes(scenario)) {
      Deno.env.delete('GOOGLE_SERVICE_ACCOUNT_JSON'); Deno.env.delete('GOOGLE_PLAY_PACKAGE_NAME');
      Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    }
    const original = globalThis.fetch;
    const events: string[] = [];
    let applied: Record<string, unknown> | undefined;
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.hostname === 'database.invalid' && url.pathname === '/auth/v1/user') {
        events.push('auth');
        return Response.json(scenario === 'invalid-auth' ? { message: 'Invalid token' } : { id: userId },
          { status: scenario === 'invalid-auth' ? 401 : 200 });
      }
      if (url.hostname === 'database.invalid' && url.pathname.endsWith('/consume_abuse_limit')) {
        events.push('limit'); return Response.json([{ allowed: true, retry_after_seconds: 0 }]);
      }
      if (url.hostname === 'oauth2.googleapis.com') {
        events.push('oauth'); return Response.json({ access_token: 'fixture-only' });
      }
      if (url.hostname === 'androidpublisher.googleapis.com') {
        events.push('google');
        assert(url.pathname.includes('/applications/synthetic-only/purchases/subscriptionsv2/tokens/fixture-token'));
        if (scenario === 'network-failure') throw new Error('fixture network failure');
        if (scenario === 'invalid-token') return Response.json({}, { status: 404 });
        return Response.json({ subscriptionState: `SUBSCRIPTION_STATE_${scenario === 'expired-date' ? 'ACTIVE' : scenario}`,
          lineItems: [{ productId: scenario === 'product-mismatch' ? 'kad_diamond_annual' : 'kad_platinum_monthly',
            expiryTime: scenario === 'expired-date' ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z' }] });
      }
      if (url.hostname === 'database.invalid' && url.pathname.endsWith('/apply_google_play_purchase')) {
        events.push('apply'); applied = JSON.parse(String(init?.body));
        assert(applied?.p_user_id === userId, 'must ignore forged body identity');
        if (scenario === 'other-owner') return Response.json({ message: 'belongs to another account' }, { status: 400 });
        return Response.json([{ entitled: applied!.p_entitled,
          subscription_status: applied!.p_entitled ? applied!.p_provider_status : 'expired',
          current_period_end: applied!.p_expires_at, auto_renew: applied!.p_auto_renew }]);
      }
      throw new Error('Unexpected fixture URL');
    };
    try {
      const response = await handler!(new Request('https://fixture.invalid', { method: 'POST',
        headers: scenario === 'missing-auth' ? {} : { Authorization: 'Bearer fixture-only', 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 'kad_platinum_monthly', purchaseToken: 'fixture-token', userId: 'forged' }),
      }));
      assert(response.status === status, `Expected ${status}, got ${response.status}`);
      const result = await response.json();
      if (entitlement !== undefined) {
        assert(result.entitled === entitlement);
        assert(applied?.p_entitled === entitlement);
        assert(events.join(',') === 'auth,limit,oauth,google,apply');
      } else if (['missing-auth', 'invalid-auth', 'not-configured'].includes(scenario)) {
        assert(events.join(',') === (scenario === 'missing-auth' ? '' : 'auth'));
        assert(result.code === (scenario === 'not-configured' ? 'server_not_configured' : 'unauthorized'));
      } else if (scenario !== 'other-owner') assert(!events.includes('apply'), 'unverified purchases must not reach persistence');
    } finally {
      globalThis.fetch = original;
      names.forEach((name, i) => previous[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, previous[i]!));
    }
  });
}
