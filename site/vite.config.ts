import { sites } from '@openai/sites-vite-plugin';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

process.env.WRANGLER_WRITE_LOGS ??= 'false';
process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

const { cloudflare } = await import('@cloudflare/vite-plugin');

const localPilot: Plugin = {
  name: 'kad-local-pilot-dev-only',
  configureServer(server) {
    server.middlewares.use('/local-pilot', (request, response) => {
      const file = request.url?.split('?')[0].slice(1);
      if (request.method !== 'GET' || (file !== 'manifesto.json' && file !== 'questoes.jsonl')) {
        response.writeHead(404).end();
        return;
      }
      void readFile(resolve(import.meta.dirname, '.local-pilot', file)).then(contents => {
        response.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'application/x-ndjson');
        response.setHeader('Cache-Control', 'no-store');
        response.end(contents);
      }).catch(() => response.writeHead(404).end());
    });
  },
};

export default defineConfig({
  appType: 'spa',
  plugins: [sites(), cloudflare({ viteEnvironment: { name: 'server' } }), localPilot],
  server: {
    fs: {
      // Permite que o adaptador leia somente os catálogos puros compartilhados da raiz.
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
  build: {
    target: 'baseline-widely-available',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('..', import.meta.url)),
    },
  },
});
