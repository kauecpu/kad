type Environment = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  KAD_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

const JSON_LD_SCRIPT_HASH = "'sha256-B3Fc+wsyStPfj2h21EO1h1WXrQMmrYhM01CfLmGhbGg='";

const BASE_SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
} as const;

function trustedSupabaseOrigins(value?: string): string[] {
  if (!value) return [];
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return [];
    return [url.origin, url.origin.replace(/^https:/, 'wss:')];
  } catch {
    return [];
  }
}

function contentSecurityPolicy(env: Environment): string {
  const connectSources = ["'self'", ...trustedSupabaseOrigins(env.SUPABASE_URL)];
  return [
    "default-src 'self'",
    `script-src 'self' ${JSON_LD_SCRIPT_HASH}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSources.join(' ')}`,
    "img-src 'self' data: https:",
    "font-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function secure(response: Response, request: Request, env: Environment): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) headers.set(name, value);

  const url = new URL(request.url);
  if (!isLocalHostname(url.hostname)) {
    headers.set('Content-Security-Policy', contentSecurityPolicy(env));
    if (url.protocol === 'https:') {
      headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  }
  if (url.hostname.endsWith('.workers.dev')) headers.set('X-Robots-Tag', 'noindex, nofollow');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function methodNotAllowed(request: Request, env: Environment): Response {
  return secure(new Response(null, {
    status: 405,
    headers: { Allow: 'GET, HEAD' },
  }), request, env);
}

export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === 'www.kadconcursos.com.br') {
      url.hostname = 'kadconcursos.com.br';
      return secure(Response.redirect(url, 308), request, env);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(request, env);

    if (url.pathname === '/api/public-config') {
      const response = Response.json({
        environment: env.KAD_ENV ?? null,
        url: env.SUPABASE_URL ?? null,
        publishableKey: env.SUPABASE_PUBLISHABLE_KEY ?? null,
      }, {
        headers: { 'Cache-Control': 'no-store' },
      });
      return secure(request.method === 'HEAD'
        ? new Response(null, { status: response.status, headers: response.headers })
        : response, request, env);
    }

    const fallbackUrl = new URL('/', request.url);
    const response = await env.ASSETS.fetch(new Request(fallbackUrl, request));
    return secure(request.method === 'HEAD'
      ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers })
      : response, request, env);
  },
};
