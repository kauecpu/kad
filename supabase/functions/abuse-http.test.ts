type Handler = (request: Request) => Promise<Response>;
const handlers: Handler[] = [];
const serve = Object.getOwnPropertyDescriptor(Deno, 'serve')!;
const configuredOrigin = 'https://existing-preview.example.invalid';
const previousOrigins = Deno.env.get('ALLOWED_WEB_ORIGINS');
Deno.env.set('ALLOWED_WEB_ORIGINS', ` ${configuredOrigin}/ `);
Object.defineProperty(Deno, 'serve', { configurable: true, value: (handler: Handler) => handlers.push(handler) });
try {
  await import('./validate-google-purchase/index.ts');
  await import('./cancel-subscription/index.ts');
  await import('./delete-account/index.ts');
} finally {
  Object.defineProperty(Deno, 'serve', serve);
  if (previousOrigins === undefined) Deno.env.delete('ALLOWED_WEB_ORIGINS');
  else Deno.env.set('ALLOWED_WEB_ORIGINS', previousOrigins);
}
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
  for (const scenario of ['allowed','limited','store-failure','malformed-limit','unauthorized','oversize','captcha-invalid','captcha-missing','captcha-expired','wrong-password','invalid-json']) {
    if ((scenario.startsWith('captcha-') || ['wrong-password','invalid-json'].includes(scenario)) && index !== 2) continue;
    for (const origin of index === 2 ? [undefined, 'https://kadconcursos.com.br', 'https://www.kadconcursos.com.br', configuredOrigin] : [undefined]) {
    Deno.test(`${operations[index]} HTTP: ${scenario}, origin=${origin ?? 'native'}`, async () => {
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
            if (scenario === 'wrong-password') return Response.json({ code:'invalid_credentials', msg:'Invalid credentials' }, { status:400 });
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
          headers:{ Authorization:'Bearer synthetic-only', 'content-type':'application/json', 'x-forwarded-for':'1.2.3.4', 'cf-connecting-ip':'5.6.7.8', ...(origin ? { Origin:origin } : {}) },
          body:scenario === 'oversize' ? JSON.stringify({x:'x'.repeat(25000)}) : scenario === 'invalid-json' ? '{' : JSON.stringify(payload) }));
        const expected = scenario === 'allowed' ? 200 : scenario === 'limited' ? 429
          : ['store-failure','malformed-limit'].includes(scenario) ? 503 : scenario === 'unauthorized' ? 401 : scenario === 'oversize' ? 413 : scenario === 'wrong-password' ? 403 : 400;
        assert(response.status === expected, `Expected ${expected}, got ${response.status}`);
        assert(response.headers.get('Access-Control-Allow-Origin') === (origin ?? null), 'Response must keep the exact authorized origin');
        assert(response.headers.get('Vary') === 'Origin');
        if (scenario === 'limited') assert(response.headers.get('Retry-After') === '60');
        if (['limited','store-failure','malformed-limit','oversize','invalid-json'].includes(scenario) || scenario.startsWith('captcha-')) {
          assert(response.headers.get('Cache-Control') === 'no-store');
          assert(response.headers.get('Access-Control-Expose-Headers') === 'Retry-After, X-Request-ID');
          assert(response.headers.get('X-Request-ID'));
          const body = await response.clone().json();
          assert(body.requestId === response.headers.get('X-Request-ID'));
          if (scenario === 'limited') assert(body.code === 'rate_limited');
          if (scenario === 'store-failure' || scenario === 'malformed-limit') {
            assert(response.headers.get('Retry-After') === '30');
            assert(body.code === 'abuse_protection_unavailable');
          }
        }
        if (scenario === 'allowed') { assert(providerCalls > 0); assert(privilegedWrites === 1); assert(limiterCalls === 1); }
        else if (scenario.startsWith('captcha-') || scenario === 'wrong-password') assert(privilegedWrites === 0);
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
}

Deno.test('delete-account CORS: exact origins, native requests and preflight without bypassing identity', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Preflight/rejected origin/anonymous request must not access a service'); };
  try {
    const allowed = [undefined, 'https://kadconcursos.com.br', 'https://www.kadconcursos.com.br', configuredOrigin,
      'http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:8082', 'http://127.0.0.1:8082'];
    const rejected = ['https://invalid.example', 'https://kadconcursos.com.br.evil.invalid',
      'https://evil.kadconcursos.com.br', 'http://kadconcursos.com.br', 'https://kadconcursos.com.br:444', 'null'];
    for (const origin of [...allowed, ...rejected]) {
      const accepted = allowed.includes(origin);
      for (const method of ['OPTIONS', 'POST', 'GET']) {
        const response = await handlers[2](new Request('https://fixture.invalid', {
          method, headers:origin ? { Origin:origin } : {},
        }));
        assert(response.status === (accepted ? method === 'OPTIONS' ? 200 : method === 'POST' ? 401 : 405 : 403), `${method} ${origin}: unexpected status ${response.status}`);
        assert(response.headers.get('Access-Control-Allow-Origin') === (accepted ? origin ?? null : null));
        assert(response.headers.get('Vary') === 'Origin');
        if (accepted && method === 'OPTIONS') {
          assert(response.headers.get('Access-Control-Allow-Methods') === 'POST, OPTIONS');
          assert(response.headers.get('Access-Control-Allow-Headers') === 'authorization, x-client-info, apikey, content-type');
        }
        await response.body?.cancel();
      }
    }
    // Domain allowance is local to deletion, not a change to the shared allowlist.
    for (const handler of handlers.slice(0, 2)) {
      for (const origin of ['https://kadconcursos.com.br', 'https://www.kadconcursos.com.br', configuredOrigin]) {
        const response = await handler(new Request('https://fixture.invalid', { method:'OPTIONS', headers:{ Origin:origin } }));
        assert(response.status === (origin === configuredOrigin ? 200 : 403));
        assert(response.headers.get('Access-Control-Allow-Origin') === (origin === configuredOrigin ? configuredOrigin : null));
        await response.body?.cancel();
      }
    }
  } finally { globalThis.fetch = original; }
});
