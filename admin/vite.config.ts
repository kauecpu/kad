import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const adminEnv = loadEnv(mode, '.', 'VITE_');
  const workspaceEnv = loadEnv(mode, '..', 'EXPO_PUBLIC_');

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        adminEnv.VITE_SUPABASE_URL || workspaceEnv.EXPO_PUBLIC_SUPABASE_URL || '',
      ),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        adminEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
          workspaceEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          '',
      ),
    },
    server: {
      strictPort: true,
    },
    build: {
      sourcemap: true,
    },
  };
});
