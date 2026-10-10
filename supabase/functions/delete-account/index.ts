import { createClient } from 'npm:@supabase/supabase-js@2';
import { boundedFetch, enforceAbuseLimit, logSecurityEvent, readRequestObject, RequestBodyError, securityResponse } from '../_shared/abuse-protection.ts';

const configuredWebOrigins = (Deno.env.get('ALLOWED_WEB_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedWebOrigins = new Set([
  // Only account deletion adds these hosts; preserve the shared configuration.
  'https://kadconcursos.com.br',
  'https://www.kadconcursos.com.br',
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

function withDeletionCors(response: Response, origin: string | null) {
  // Shared security responses must use this function's allowlist too, while
  // retaining Retry-After, request correlation, status, body and cache policy.
  for (const [name, value] of Object.entries(responseHeaders(origin))) {
    response.headers.set(name, value);
  }
  return response;
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
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
      global: { headers: { Authorization: authorization }, fetch: boundedFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await readRequestObject(request, 24576);
    const currentPassword =
      typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken : undefined;
    if (!currentPassword || currentPassword.length > 4096 || (captchaToken?.length ?? 0) > 2048 || !user.email) {
      return Response.json(
        { error: 'Password confirmation required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { fetch: boundedFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const blocked = await enforceAbuseLimit(adminClient, user.id, 'account_delete', origin, requestId);
    if (blocked) return withDeletionCors(blocked, origin);
    const verificationClient = createClient(supabaseUrl, anonKey, {
      global: { fetch: boundedFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: verification, error: verificationError } =
      await verificationClient.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
        options: { captchaToken },
      });
    if (verificationError || verification.user?.id !== user.id) {
      if (verificationError?.code === 'captcha_failed') {
        return withDeletionCors(securityResponse('captcha_failed', 400, origin, requestId), origin);
      }
      return Response.json(
        { error: 'Password confirmation failed' },
        { status: 403, headers: corsHeaders }
      );
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      logSecurityEvent('account_delete', error.code, requestId);
      return withDeletionCors(securityResponse(error.code, error.status, origin, requestId), origin);
    }
    logSecurityEvent('account_delete', 'deletion_unavailable', requestId);
    return Response.json(
      { error: 'Unable to delete account' },
      { status: 500, headers: corsHeaders }
    );
  }
});
