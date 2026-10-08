type Handler = (request: Request) => Promise<Response>;
const handlers: Handler[] = [];
const serve = Object.getOwnPropertyDescriptor(Deno, 'serve')!;
Object.defineProperty(Deno, 'serve', { configurable: true, value: (handler: Handler) => handlers.push(handler) });
try {
  await import('./validate-google-purchase/index.ts');
  await import('./cancel-subscription/index.ts');
  await import('./delete-account/index.ts');
} finally { Object.defineProperty(Deno, 'serve', serve); }
const operations = ['google_purchase_validate','subscription_cancel','account_delete'];
const userId = '10000000-0000-4000-8000-000000000001';
function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message); }

// Generated disposable signing material; not a Google credential and never written to disk.
const keys = await crypto.subtle.generateKey({ name:'RSASSA-PKCS1-v1_5', modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256' }, true, ['sign','verify']);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keys.privateKey));
const fixtureAccount = JSON.stringify({ client_email:'fixture@example.invalid',
  private_key:`-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----` });

for (let index = 0; index < handlers.length; index++) {
  for (const scenario of ['allowed','limited','store-failure','malformed-limit','unauthorized','oversize','captcha-invalid','captcha-missing','captcha-expired']) {
    if (scenario.startsWith('captcha-') && index !== 2) continue;
    Deno.test(`${operations[index]} HTTP: ${scenario}`, async () => {
      const names = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GOOGLE_PLAY_PACKAGE_NAME','GOOGLE_SERVICE_ACCOUNT_JSON','MERCADO_PAGO_ACCESS_TOKEN'];
      const previous = names.map(name => Deno.env.get(name));
      names.forEach(name => Deno.env.set(name, name === 'SUPABASE_URL' ? 'https://database.invalid'
        : name === 'GOOGLE_SERVICE_ACCOUNT_JSON' ? fixtureAccount : 'synthetic-only'));
      const original = globalThis.fetch; const beforeWarn = console.warn; const beforeError = console.error;
      let providerCalls = 0; let privilegedWrites = 0; let limiterCalls = 0;
      const logs: string[] = []; console.warn = value => logs.push(String(value)); console.error = () => {};
      globalThis.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.hostname === 'database.invalid') {
          if (url.pathname === '/auth/v1/user') return Response.json(scenario === 'unauthorized'
            ? { message:'Invalid token' } : { id:userId, email:'fixture@example.invalid' }, { status:scenario === 'unauthorized' ? 401 : 200 });
          if (url.pathname.endsWith('/consume_abuse_limit')) {
            limiterCalls++;
            const body = JSON.parse(String(init?.body));
            assert(body.p_user_id === userId && body.p_operation === operations[index], 'Limiter trusted client identity');
            assert(!('ip' in body), 'Untrusted forwarded headers entered limiter');
            return Response.json(scenario === 'store-failure' ? { message:'sensitive-error' }
              : scenario === 'malformed-limit' ? [] : [{ allowed:scenario !== 'limited', retry_after_seconds:scenario === 'limited' ? 60 : 0 }],
              { status:scenario === 'store-failure' ? 500 : 200 });
          }
          if (url.pathname.endsWith('/subscriptions')) return Response.json({ provider:'mercado_pago', provider_subscription_id:'fixture-sub', cancel_at_period_end:false, current_period_end:'2035-01-01T00:00:00Z' });
          if (url.pathname === '/auth/v1/token') {
            providerCalls++;
            const body = JSON.parse(String(init?.body));
            assert(body.gotrue_meta_security?.captcha_token === (scenario === 'captcha-missing' ? undefined : 'fixture-captcha'));
            if (scenario.startsWith('captcha-')) return Response.json({ code:'captcha_failed', msg:'CAPTCHA rejected' }, { status:422, headers:{'x-supabase-api-version':'2024-01-01'} });
            return Response.json({ access_token:'synthetic-token', refresh_token:'synthetic-refresh', expires_in:3600,
              token_type:'bearer', user:{ id:userId, email:'fixture@example.invalid' } });
          }
          if (url.pathname.includes('/admin/users/') || url.pathname.endsWith('/sync_mercado_pago_subscription') || url.pathname.endsWith('/apply_google_play_purchase')) {
            privilegedWrites++;
            return Response.json(url.pathname.endsWith('/apply_google_play_purchase')
              ? [{ entitled:true, subscription_status:'active', current_period_end:'2035-01-01T00:00:00Z' }] : {});
          }
        }
        if (url.hostname === 'oauth2.googleapis.com') { providerCalls++; return Response.json({access_token:'fixture-provider-token'}); }
        if (url.hostname === 'androidpublisher.googleapis.com') { providerCalls++; return Response.json({ subscriptionState:'SUBSCRIPTION_STATE_ACTIVE', lineItems:[{productId:'kad_platinum_monthly',expiryTime:'2035-01-01T00:00:00Z'}] }); }
        if (url.hostname === 'api.mercadopago.com') { providerCalls++; return Response.json({id:'fixture-sub',status:'canceled',last_modified:'2030-01-01T00:00:00Z'}); }
        throw new Error(`Unexpected fixture request: ${url.hostname}${url.pathname}`);
      };
      try {
        const payload = index === 0 ? { productId:'kad_platinum_monthly',purchaseToken:'sensitive-purchase-token',userId:'forged' }
          : index === 1 ? { userId:'forged' } : { currentPassword:'sensitive-password', captchaToken:scenario === 'captcha-missing' ? undefined : 'fixture-captcha', userId:'forged' };
        const response = await handlers[index](new Request('https://fixture.invalid', { method:'POST',
          headers:{ Authorization:'Bearer synthetic-only', 'content-type':'application/json', 'x-forwarded-for':'1.2.3.4', 'cf-connecting-ip':'5.6.7.8' },
          body:scenario === 'oversize' ? JSON.stringify({x:'x'.repeat(25000)}) : JSON.stringify(payload) }));
        const expected = scenario === 'allowed' ? 200 : scenario === 'limited' ? 429
          : ['store-failure','malformed-limit'].includes(scenario) ? 503 : scenario === 'unauthorized' ? 401 : scenario === 'oversize' ? 413 : 400;
        assert(response.status === expected, `Expected ${expected}, got ${response.status}`);
        if (scenario === 'limited') assert(response.headers.get('Retry-After') === '60');
        if (scenario === 'allowed') { assert(providerCalls > 0); assert(privilegedWrites === 1); assert(limiterCalls === 1); }
        else if (scenario.startsWith('captcha-')) assert(privilegedWrites === 0);
        else { assert(providerCalls === 0); assert(privilegedWrites === 0); }
        assert(!logs.join('').includes('sensitive-'));
        await response.body?.cancel();
      } finally {
        globalThis.fetch = original; console.warn = beforeWarn; console.error = beforeError;
        names.forEach((name,i) => previous[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name,previous[i]!));
      }
    });
  }
}
