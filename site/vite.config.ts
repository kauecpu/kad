import { sites } from '@openai/sites-vite-plugin';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { fileURLToPath } from 'node:url';

process.env.WRANGLER_WRITE_LOGS ??= 'false';
process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

const { cloudflare } = await import('@cloudflare/vite-plugin');

export default defineConfig({
  appType: 'spa',
  plugins: [sites(), cloudflare({ viteEnvironment: { name: 'server' } })],
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
