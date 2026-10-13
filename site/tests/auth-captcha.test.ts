import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../server/index.ts';
import { captchaPage } from '../server/captcha-page.ts';
import { requestAuthCaptcha } from '../src/services/auth-captcha.ts';

test('challenge page escapes configuration, sets CSP and never includes a secret', async () => {
  for (const key of [undefined, '</script><script>alert(1)</script>', 'fixture-public-key']) {
    const response = captchaPage(key);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(response.headers.get('Content-Security-Policy')!, /frame-ancestors 'self'/);
    const html = await response.text();
    assert.doesNotMatch(html, /alert\(1\)|service_role|TURNSTILE_SECRET/);
    if (key === 'fixture-public-key') assert.match(html, /sitekey: "fixture-public-key"/);
    else assert.doesNotMatch(html, /<script[^>]* src=/);
    assert.match(html, /parent\.postMessage\(message, location\.origin\)/);
    assert.match(html, /retry: 'never'/);
  }
});

test('worker exposes only CAPTCHA enabled flag and serves dedicated page without SPA fallback', async () => {
  const env = { ASSETS: { fetch: async () => new Response('spa') }, AUTH_CAPTCHA_ENABLED:'true', TURNSTILE_SITE_KEY:'fixture-public-key' };
  const config = await (await worker.fetch(new Request('https://fixture.invalid/api/public-config'),env)).json();
  assert.equal(config.captchaEnabled,'true');
  const page = await worker.fetch(new Request('https://fixture.invalid/auth/captcha'),env);
  assert.match(await page.text(), /fixture-public-key/);
  for (const enabled of ['false','typo']) {
    const disabled = await worker.fetch(new Request('https://fixture.invalid/auth/captcha'),{ ...env, AUTH_CAPTCHA_ENABLED:enabled });
    assert.doesNotMatch(await disabled.text(), /fixture-public-key/);
  }
});

test('browser CAPTCHA: disabled is compatible; network/config errors fail closed without retries', async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({captchaEnabled:'false'}); };
    assert.deepEqual(await requestAuthCaptcha(),{}); assert.equal(calls,1);
    globalThis.fetch = async () => { throw new Error('sensitive server response'); };
    assert.ok((await requestAuthCaptcha()).error);
    globalThis.fetch = async () => Response.json({captchaEnabled:'typo'});
    assert.ok((await requestAuthCaptcha()).error);
  } finally { globalThis.fetch = original; }
});
