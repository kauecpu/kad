import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL as NodeUrl, fileURLToPath } from 'node:url';
import worker from '../server/index.ts';

const projectUrl = new NodeUrl('../', import.meta.url);

function environment(onAsset = () => {}): Parameters<typeof worker.fetch>[1] {
  return {
    KAD_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    ASSETS: {
      async fetch() {
        onAsset();
        return new Response('<!doctype html><title>KAD</title>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    },
  };
}

test('respostas públicas recebem cabeçalhos de segurança compatíveis com Supabase', async () => {
  const response = await worker.fetch(new Request('https://kadconcursos.com.br/'), environment());
  const policy = response.headers.get('content-security-policy') ?? '';

  assert.equal(response.status, 200);
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /script-src 'self' 'sha256-/);
  assert.match(policy, /connect-src 'self' https:\/\/project\.supabase\.co wss:\/\/project\.supabase\.co/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(response.headers.get('permissions-policy') ?? '', /camera=\(\)/);
});

test('hash CSP acompanha o JSON-LD estático usado pelo SEO', async () => {
  const html = await readFile(fileURLToPath(new NodeUrl('index.html', projectUrl)), 'utf8');
  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(jsonLd);
  const expected = createHash('sha256').update(jsonLd).digest('base64');

  const response = await worker.fetch(new Request('https://kadconcursos.com.br/'), environment());
  assert.match(response.headers.get('content-security-policy') ?? '', new RegExp(`sha256-${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('métodos não utilizados são rejeitados antes de alcançar os assets', async () => {
  let assetRequests = 0;
  const response = await worker.fetch(new Request('https://kadconcursos.com.br/', {
    method: 'POST',
    body: 'unused',
  }), environment(() => { assetRequests += 1; }));

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
  assert.equal(assetRequests, 0);
});

test('HEAD não devolve corpo e URLs temporárias não são indexadas', async () => {
  const head = await worker.fetch(new Request('https://kadconcursos.com.br/', { method: 'HEAD' }), environment());
  assert.equal(await head.text(), '');

  const preview = await worker.fetch(new Request('https://kad-concursos.example.workers.dev/'), environment());
  assert.equal(preview.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('desenvolvimento local não recebe CSP nem HSTS de produção', async () => {
  const response = await worker.fetch(new Request('http://localhost/'), environment());
  assert.equal(response.headers.get('content-security-policy'), null);
  assert.equal(response.headers.get('strict-transport-security'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});
