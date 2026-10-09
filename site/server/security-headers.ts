import { kadEnvironmentProjects } from '../../contracts/deployment-environment.ts';

export type SecurityEnvironment = { KAD_ENV?: string; SECURITY_HSTS_MAX_AGE?: string };

/** Explicit known origins also cover legacy builds with build-time Supabase config. */
export function siteContentSecurityPolicy(environment?: string): string {
  const projects = environment === 'staging' || environment === 'production'
    ? [kadEnvironmentProjects[environment]] : Object.values(kadEnvironmentProjects);
  const origins = projects.map(project => `https://${project.projectRef}.supabase.co`);
  const sockets = origins.map(origin => origin.replace('https:', 'wss:'));
  return [
    "default-src 'none'", "script-src 'self'", "style-src 'self'",
    // Existing progress bars, deck colors and rings use inline style attributes.
    // This exception does not allow inline scripts or inline <style> elements.
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${origins.join(' ')}`, "font-src 'self'",
    `connect-src 'self' ${[...origins, ...sockets].join(' ')}`,
    "frame-src 'self'", "manifest-src 'self'", "base-uri 'none'",
    "form-action 'self'", "object-src 'none'", "frame-ancestors 'none'",
  ].join('; ');
}

export function withSecurityHeaders(response: Response, request: Request, env: SecurityEnvironment): Response {
  const headers = new Headers(response.headers);
  if (!headers.has('Content-Security-Policy')) headers.set('Content-Security-Policy', siteContentSecurityPolicy(env.KAD_ENV));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', new URL(request.url).pathname === '/auth/captcha' ? 'SAMEORIGIN' : 'DENY');
  if (!headers.has('Referrer-Policy')) headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  // Opt-in, bounded rollout. No preload or inheritance to unreviewed subdomains.
  if (new URL(request.url).protocol === 'https:' && /^(0|[1-9]\d{0,7})$/.test(env.SECURITY_HSTS_MAX_AGE ?? '')
    && Number(env.SECURITY_HSTS_MAX_AGE) <= 31536000) {
    headers.set('Strict-Transport-Security', `max-age=${env.SECURITY_HSTS_MAX_AGE}`);
  }
  return new Response(request.method === 'HEAD' ? null : response.body,
    { status: response.status, statusText: response.statusText, headers });
}
