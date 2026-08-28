import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const adminEnv = loadEnv(mode, '.', 'VITE_');
  const workspaceEnv = loadEnv(mode, '..', 'EXPO_PUBLIC_');

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        process.env.VITE_SUPABASE_URL ||
          adminEnv.VITE_SUPABASE_URL ||
          process.env.EXPO_PUBLIC_SUPABASE_URL ||
          workspaceEnv.EXPO_PUBLIC_SUPABASE_URL ||
          '',
      ),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          adminEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          workspaceEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          '',
      ),
      'import.meta.env.VITE_KAD_ENV': JSON.stringify(
        process.env.VITE_KAD_ENV ||
          adminEnv.VITE_KAD_ENV ||
          process.env.EXPO_PUBLIC_KAD_ENV ||
          workspaceEnv.EXPO_PUBLIC_KAD_ENV ||
          '',
      ),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('..', import.meta.url)),
      },
    },
    server: {
      strictPort: true,
    },
    build: {
      sourcemap: true,
    },
  };
});
