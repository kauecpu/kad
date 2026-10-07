import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createPasswordSecurity } from '../src/core/password-security.ts';
import { parseRecoveryCallback } from '../src/core/auth-callback.ts';

// Real pinned SDK; all HTTP responses and identities below are local fixtures.
// The transport rejects any unlisted request. No email or Supabase project is contacted.
function fixture() {
  const memory = new Map<string, string>();
  const requests: string[] = [];
  const origin = 'https://kad.example';
  let redirect = '';
  let codeConsumed = false;
  const user = { id: 'fixture-user', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } });
  function client(storage = memory) {
    return createClient('https://fixture.supabase.co', 'fixture-public-key', {
      auth: {
        storageKey: 'fixture-auth', flowType: 'pkce', detectSessionInUrl: false,
        autoRefreshToken: false, persistSession: true,
        experimental: { appendPkceFlowIdToRedirects: true },
        storage: {
          getItem: key => storage.get(key) ?? null,
          setItem: (key, value) => { storage.set(key, value); },
          removeItem: key => { storage.delete(key); },
        },
      },
      global: {
        fetch: async (input, init) => {
          const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
          assert.equal(url.origin, 'https://fixture.supabase.co');
          requests.push(`${init?.method ?? 'GET'} ${url.pathname}`);
          if (url.pathname === '/auth/v1/recover') {
            redirect = url.searchParams.get('redirect_to') ?? '';
            const payload = JSON.parse(String(init?.body));
            assert.equal(payload.code_challenge_method, 's256');
            assert.ok(payload.code_challenge);
            return json({});
          }
          if (url.pathname === '/auth/v1/token') {
            assert.equal(url.searchParams.get('grant_type'), 'pkce');
            const payload = JSON.parse(String(init?.body));
            assert.ok(payload.code_verifier);
            if (codeConsumed) return json({ code: 'flow_state_not_found', message: 'Fixture code consumed' }, 400);
            codeConsumed = true;
            const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
            return json({
              access_token: `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`,
              refresh_token: 'fixture-refresh-not-a-real-credential', expires_in: 3600, token_type: 'bearer', user,
            });
          }
          if (url.pathname === '/auth/v1/user') return json(user);
          if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
          throw new Error('Unexpected fixture endpoint');
        },
      },
    });
  }
  return { client, requests, origin, callback() {
    const url = new URL(redirect);
    url.searchParams.set('code', 'fixture-one-time-code');
    const callback = parseRecoveryCallback(url.href, origin);
    assert.ok(callback);
    return callback;
  } };
}

test('SDK fixado: pedido PKCE → callback recovery → nova senha → logout, sem rede real', async () => {
  const f = fixture();
  const client = f.client();
  const result = await client.auth.resetPasswordForEmail('fixture@example.test', { redirectTo: `${f.origin}/nova-senha` });
  assert.equal(result.error, null);
  const security = createPasswordSecurity(client.auth);
  const callback = f.callback();
  assert.equal((await security.completeRecovery(callback)).ok, true);
  assert.equal((await security.updateRecovered('fixture-password')).ok, true);
  assert.equal((await client.auth.getSession()).data.session, null);
  assert.equal(f.requests.filter(path => path === 'POST /auth/v1/recover').length, 1);
  assert.ok(f.requests.includes('PUT /auth/v1/user'));
  assert.equal(f.requests.filter(path => path === 'POST /auth/v1/logout').length, 2);
  // The SDK has consumed the verifier; reopening must not grant recovery again.
  assert.deepEqual(await security.completeRecovery(callback), { ok: false, reason: 'session-missing' });
});

test('SDK fixado: outro navegador sem storage recusa antes de chamar /token', async () => {
  const f = fixture();
  await f.client().auth.resetPasswordForEmail('fixture@example.test', { redirectTo: `${f.origin}/nova-senha` });
  const otherBrowser = f.client(new Map());
  const security = createPasswordSecurity(otherBrowser.auth);
  assert.deepEqual(await security.completeRecovery(f.callback()), { ok: false, reason: 'session-missing' });
  assert.equal(f.requests.filter(path => path === 'POST /auth/v1/token').length, 0);
});
