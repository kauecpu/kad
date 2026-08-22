import { defineConfig, searchForWorkspaceRoot } from 'vite';

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
});
