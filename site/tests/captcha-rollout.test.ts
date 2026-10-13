import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import worker from '../server/index.ts';

test('approved reduced rollout keeps CAPTCHA off without disabling Auth protection remotely', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.vars.AUTH_CAPTCHA_ENABLED, 'false');
  const rollout = {
    ASSETS: { fetch: async () => new Response('fixture') },
    ...config.vars, TURNSTILE_SITE_KEY: 'fixture-public-key',
  };
  const response = await worker.fetch(new Request('https://fixture.invalid/api/public-config'), rollout);
  assert.equal((await response.json()).captchaEnabled, 'false');
  const challenge = await worker.fetch(new Request('https://fixture.invalid/auth/captcha'), rollout);
  const html = await challenge.text();
  assert.match(html, /Verificação indisponível/);
  assert.doesNotMatch(html, /src="https:\/\/challenges.cloudflare.com/);
});
