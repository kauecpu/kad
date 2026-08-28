import { createClient } from '@supabase/supabase-js';
import { resolvePublicSupabaseConfig } from '@/contracts/deployment-environment';

const publicSupabaseConfig = resolvePublicSupabaseConfig({
  environment: import.meta.env.VITE_KAD_ENV,
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
const supabaseUrl = publicSupabaseConfig.ok ? publicSupabaseConfig.value.url : undefined;
const supabasePublishableKey = publicSupabaseConfig.ok
  ? publicSupabaseConfig.value.publishableKey
  : undefined;

export const isPreviewMode =
  import.meta.env.DEV && import.meta.env.VITE_ADMIN_PREVIEW === 'true';

export const hasSupabaseConfig = publicSupabaseConfig.ok;
export const adminSupabaseProjectRef = publicSupabaseConfig.ok
  ? publicSupabaseConfig.value.projectRef
  : null;
export const adminKadEnvironment = publicSupabaseConfig.ok
  ? publicSupabaseConfig.value.environment
  : null;

export const supabase = hasSupabaseConfig
  && supabaseUrl
  && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    })
  : null;
