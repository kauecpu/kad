import { createClient } from 'npm:@supabase/supabase-js@2';

const configuredWebOrigins = (Deno.env.get('ALLOWED_WEB_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedWebOrigins = new Set([
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:8082',
  'http://127.0.0.1:8082',
  ...configuredWebOrigins,
]);

function responseHeaders(origin: string | null) {
  return {
    ...(origin && allowedWebOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const corsHeaders = responseHeaders(origin);

  if (origin && !allowedWebOrigins.has(origin)) {
    return Response.json({ error: 'Origin not allowed' }, { status: 403, headers: corsHeaders });
  }
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: { ...corsHeaders, Allow: 'POST' } }
    );
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return Response.json(
        { error: 'Server configuration is incomplete' },
        { status: 500, headers: corsHeaders }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = (await request.json().catch(() => null)) as {
      currentPassword?: unknown;
    } | null;
    const currentPassword =
      typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    if (!currentPassword || !user.email) {
      return Response.json(
        { error: 'Password confirmation required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const verificationClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: verification, error: verificationError } =
      await verificationClient.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
    if (verificationError || verification.user?.id !== user.id) {
      return Response.json(
        { error: 'Password confirmation failed' },
        { status: 403, headers: corsHeaders }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch {
    return Response.json(
      { error: 'Unable to delete account' },
      { status: 500, headers: corsHeaders }
    );
  }
});
