// Built Worker at loopback; all provider traffic is intercepted, no real credentials.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const base = process.env.KAD_TEST_SITE_URL ?? 'http://127.0.0.1:4186';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Requires local Worker');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const violations = []; const errors = []; const authCalls = [];
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.__cspViolations.push({ directive: event.effectiveDirective, uri: event.blockedURI }));
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    if (url.origin === 'https://challenges.cloudflare.com' && url.pathname === '/turnstile/v0/api.js') {
      return route.fulfill({ contentType: 'text/javascript', body: 'window.turnstile={render:(_el,options)=>{window.fixtureWidget=options; return "fixture";}}; window.kadCaptchaReady();' });
    }
    if (url.origin === 'https://npaoyezfwmgauirrlyog.supabase.co') {
      const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST,GET,OPTIONS' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (['/auth/v1/token', '/auth/v1/recover', '/auth/v1/signup'].includes(url.pathname)) {
        authCalls.push({ path: url.pathname, body: route.request().postDataJSON() });
        return route.fulfill({ status: 400, contentType: 'application/json', headers,
          body: JSON.stringify({ error_code: 'invalid_credentials', msg: 'Fixture response' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers, body: '[]' });
    }
    errors.push(`Unexpected external host ${url.hostname}`);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/', '/entrar', '/recuperar-senha', '/nova-senha', '/inicio']) {
    const response = await page.goto(base + path);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['x-content-type-options'], 'nosniff');
    await page.locator('#app').waitFor();
    await page.waitForFunction(() => document.querySelector('#app').textContent.trim().length > 100);
    violations.push(...await page.evaluate(() => window.__cspViolations));
  }
  await page.goto(base + '/entrar');
  const form = page.locator('form[data-form="login"]').filter({ visible: true });
  await form.locator('input[name="email"]').fill('fixture@example.invalid');
  await form.locator('input[name="password"]').fill('Fixture-password-123!');
  await form.locator('button[type="submit"]').click();
  await page.locator('.auth-captcha-dialog[open]').waitFor();
  const frame = await (await page.locator('.auth-captcha-dialog iframe').elementHandle()).contentFrame();
  await frame.waitForFunction(() => Boolean(window.fixtureWidget));
  violations.push(...await frame.evaluate(() => window.__cspViolations));
  assert.equal(authCalls.length, 0, 'no authentication request before challenge');
  await frame.evaluate(() => window.fixtureWidget.callback('fixture-captcha'));
  await page.waitForFunction(() => !document.querySelector('.auth-captcha-dialog'));
  await page.waitForFunction(() => !document.querySelector('form[data-form="login"] button[type="submit"]').disabled);
  assert.equal(authCalls.length, 1);
  assert.equal(authCalls[0].body.gotrue_meta_security.captcha_token, 'fixture-captcha');
  violations.push(...await page.evaluate(() => window.__cspViolations));
  for (const [path, formName, endpoint] of [['/recuperar-senha', 'recovery', '/auth/v1/recover'], ['/cadastro', 'signup', '/auth/v1/signup']]) {
    await page.goto(base + path);
    const nextForm = page.locator(`form[data-form="${formName}"]`);
    await nextForm.locator('input[name="email"]').fill('fixture@example.invalid');
    if (formName === 'signup') {
      await nextForm.locator('input[name="name"]').fill('Conta Fictícia');
      await nextForm.locator('input[name="password"]').fill('Fixture-password-123!');
      await nextForm.locator('input[name="passwordConfirmation"]').fill('Fixture-password-123!');
    }
    await nextForm.locator('button[type="submit"]').click();
    await page.locator('.auth-captcha-dialog[open]').waitFor();
    const challenge = await (await page.locator('.auth-captcha-dialog iframe').elementHandle()).contentFrame();
    await challenge.waitForFunction(() => Boolean(window.fixtureWidget));
    violations.push(...await challenge.evaluate(() => window.__cspViolations));
    const submitted = page.waitForResponse(response => new URL(response.url()).pathname === endpoint);
    await challenge.evaluate(() => window.fixtureWidget.callback('fixture-captcha'));
    await submitted;
    assert.equal(authCalls.at(-1).body.gotrue_meta_security.captcha_token, 'fixture-captcha');
    violations.push(...await page.evaluate(() => window.__cspViolations));
  }
  assert.deepEqual(violations, []);
  assert.deepEqual(errors, []);
  console.log('PASS built Worker/browser: routes, JS/CSS/assets, login/signup/recovery, challenge iframe + nonce CSP, mocked tokens forwarded to Auth; no CSP violations/page errors; no real provider traffic.');
} finally { await browser.close(); }
