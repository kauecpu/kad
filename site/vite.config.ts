import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  appType: 'spa',
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
