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

export function corsHeaders(origin: string | null) {
  return {
    ...(origin && allowedWebOrigins.has(origin)
      ? { 'Access-Control-Allow-Origin': origin }
      : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function rejectDisallowedOrigin(request: Request): Response | null {
  const origin = request.headers.get('Origin');
  if (!origin || allowedWebOrigins.has(origin)) return null;
  return Response.json(
    { error: 'Origin not allowed', code: 'origin_not_allowed' },
    { status: 403, headers: corsHeaders(origin) }
  );
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null
) {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}
