import { captchaPage } from './captcha-page.ts';
import { captchaEnabled } from '../../contracts/auth-captcha.ts';
import { withSecurityHeaders, type SecurityEnvironment } from './security-headers.ts';

type Environment = SecurityEnvironment & {
  ASSETS: { fetch(request: Request): Promise<Response> };
  KAD_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  AUTH_CAPTCHA_ENABLED?: string;
  TURNSTILE_SITE_KEY?: string;
};

async function route(request: Request, env: Environment): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname === 'www.kadconcursos.com.br') {
    url.hostname = 'kadconcursos.com.br';
    return Response.redirect(url, 308);
  }
  const read = request.method === 'GET' || request.method === 'HEAD';
  if (read && url.pathname === '/api/public-config') {
    return Response.json({
      environment: env.KAD_ENV ?? null,
      url: env.SUPABASE_URL ?? null,
      publishableKey: env.SUPABASE_PUBLISHABLE_KEY ?? null,
      captchaEnabled: env.AUTH_CAPTCHA_ENABLED ?? 'false',
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (read && url.pathname === '/auth/captcha') {
    let enabled = false;
    try { enabled = captchaEnabled(env.AUTH_CAPTCHA_ENABLED); } catch { /* invalid config fails closed */ }
    return captchaPage(enabled ? env.TURNSTILE_SITE_KEY : undefined);
  }
  // The binding handles SPA fallback; preserve actual asset paths and methods.
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    let response: Response;
    try { response = await route(request, env); }
    catch { response = new Response('Service unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
    return withSecurityHeaders(response, request, env);
  },
};
