import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import worker from '../server/index.ts';
import { siteContentSecurityPolicy } from '../server/security-headers.ts';

const env = { ASSETS: { fetch: async (request: Request) => new Response(new URL(request.url).pathname,
  { headers: { 'Content-Type': 'text/html', ETag: 'fixture' } }) } };

for (const path of ['/inicio', '/login', '/nova-senha', '/api/public-config', '/assets/fixture.js', '/missing']) {
  test(`security headers cover ${path}`, async () => {
    const response = await worker.fetch(new Request(`https://fixture.invalid${path}`), env);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.match(response.headers.get('Permissions-Policy')!, /camera=\(\)/);
    const csp = response.headers.get('Content-Security-Policy')!;
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(csp, /\*|unsafe-eval|script-src[^;]*unsafe-inline/);
    assert.equal(response.headers.get('Strict-Transport-Security'), null, 'HSTS requires explicit rollout');
  });
}

test('asset paths, status, cache and body survive middleware; redirects/errors are protected', async () => {
  const asset = await worker.fetch(new Request('https://fixture.invalid/assets/main.js'), env);
  assert.equal(await asset.text(), '/assets/main.js');
  assert.equal(asset.headers.get('ETag'), 'fixture');
  const redirect = await worker.fetch(new Request('https://www.kadconcursos.com.br/login?next=1'), env);
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('Location'), 'https://kadconcursos.com.br/login?next=1');
  assert.equal(redirect.headers.get('X-Content-Type-Options'), 'nosniff');
  for (const status of [404, 405, 500]) {
    const response = await worker.fetch(new Request('https://fixture.invalid/missing'), {
      ASSETS: { fetch: async () => new Response('error', { status }) },
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
});

test('challenge retains nonce CSP, same-origin framing and no-store', async () => {
  const response = await worker.fetch(new Request('https://fixture.invalid/auth/captcha'), {
    ...env, AUTH_CAPTCHA_ENABLED: 'true', TURNSTILE_SITE_KEY: 'fixture-public-key',
  });
  assert.match(response.headers.get('Content-Security-Policy')!, /script-src 'nonce-/);
  assert.match(response.headers.get('Content-Security-Policy')!, /frame-ancestors 'self'/);
  assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('worker-first routing cannot bypass challenge or security middleware', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.assets.run_worker_first, true);
});

test('HSTS opt-in is HTTPS-only, bounded, and never includes unreviewed subdomains', async () => {
  for (const value of [undefined, 'garbage', '-1', '31536001', '300; includeSubDomains']) {
    const response = await worker.fetch(new Request('https://fixture.invalid/'), { ...env, SECURITY_HSTS_MAX_AGE: value });
    assert.equal(response.headers.get('Strict-Transport-Security'), null);
  }
  for (const value of ['0', '300', '31536000']) {
    for (const scheme of ['http', 'https']) {
      const response = await worker.fetch(new Request(`${scheme}://fixture.invalid/`), { ...env, SECURITY_HSTS_MAX_AGE: value });
      assert.equal(response.headers.get('Strict-Transport-Security'), scheme === 'https' ? `max-age=${value}` : null);
    }
  }
});

test('CSP uses exact environment origins and preserves existing visual styles without inline scripts', () => {
  const staging = siteContentSecurityPolicy('staging');
  assert.match(staging, /https:\/\/npaoyezfwmgauirrlyog.supabase.co/);
  assert.match(staging, /wss:\/\/npaoyezfwmgauirrlyog.supabase.co/);
  assert.doesNotMatch(staging, /tknxtwwwoqwbzddplzzg/);
  assert.match(siteContentSecurityPolicy('production'), /tknxtwwwoqwbzddplzzg/);
  assert.match(staging, /style-src-attr 'unsafe-inline'/);
  assert.doesNotMatch(staging, /script-src[^;]*unsafe-inline|unsafe-eval|\*/);
});

test('asset exception is sanitized and receives security headers', async () => {
  const response = await worker.fetch(new Request('https://fixture.invalid/'), {
    ASSETS: { fetch: async () => { throw new Error('sensitive details'); } },
  });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /sensitive/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('HEAD preserves dedicated API/challenge headers without returning SPA or body', async () => {
  for (const path of ['/api/public-config', '/auth/captcha']) {
    const response = await worker.fetch(new Request(`https://fixture.invalid${path}`, { method: 'HEAD' }), env);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(response.headers.get('Content-Type')!, path.includes('/api/') ? /application\/json/ : /text\/html/);
  }
});
