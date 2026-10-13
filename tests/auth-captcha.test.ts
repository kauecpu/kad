import assert from 'node:assert/strict';
import test from 'node:test';
import { captchaEnabled, captchaMessage, captchaPageUrl, captchaAuthMessage } from '../contracts/auth-captcha.ts';
import { abuseErrorMessage, edgeAbuseMessage } from '../contracts/abuse-errors.ts';

test('CAPTCHA rollout: absent/disabled stays compatible; invalid config never silently disables', () => {
  for (const value of [undefined, '', false, 'false']) assert.equal(captchaEnabled(value), false);
  for (const value of [true, 'true']) assert.equal(captchaEnabled(value), true);
  for (const value of ['TRUE', 'invalid', 1, null]) assert.throws(() => captchaEnabled(value));
});
test('native challenge URL rejects non-HTTPS, credentials, query strings and other routes', () => {
  assert.equal(captchaPageUrl('https://kad.example/auth/captcha'), 'https://kad.example/auth/captcha');
  for (const url of ['http://kad.example/auth/captcha', 'javascript:alert(1)', 'https://user:pass@kad.example/auth/captcha', 'https://kad.example/auth/captcha?redirect=evil', 'https://kad.example/']) {
    assert.throws(() => captchaPageUrl(url));
  }
});
test('challenge bridge rejects forged/missing tokens and wrong request nonce; handles expiry/error', () => {
  const message = { type: 'kad-captcha', nonce: 'expected', token: 'fixture-token' };
  assert.deepEqual(captchaMessage(message, 'expected'), { token: 'fixture-token' });
  for (const value of [null, {}, { ...message, nonce: 'other' }, { ...message, token: '' }, { ...message, token: 'x'.repeat(2049) }]) {
    assert.equal(captchaMessage(value, 'expected'), null);
  }
  for (const error of ['expired', 'failed', 'unavailable']) assert.ok(captchaMessage({ ...message, error }, 'expected')?.error);
  assert.ok(captchaAuthMessage({ code: 'captcha_failed' }));
});
test('clients explain throttling and unavailability without exposing error bodies or retrying', async () => {
  assert.match(abuseErrorMessage('rate_limited', '12')!, /12 segundos/);
  assert.doesNotMatch(abuseErrorMessage('rate_limited', '<script>')!, /script/);
  assert.match(abuseErrorMessage('abuse_protection_unavailable')!, /mais tarde/);
  assert.equal(await edgeAbuseMessage({ context: Response.json({ code: 'rate_limited', error: 'SENSITIVE' }, { status: 429, headers: { 'Retry-After': '45' } }) }), 'Muitas tentativas. Aguarde 45 segundos antes de tentar novamente.');
});
