type Environment = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  KAD_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

export default {
  fetch(request: Request, env: Environment): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/public-config') {
      return Promise.resolve(Response.json({
        environment: env.KAD_ENV ?? null,
        url: env.SUPABASE_URL ?? null,
        publishableKey: env.SUPABASE_PUBLISHABLE_KEY ?? null,
      }, {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      }));
    }
    const fallbackUrl = new URL('/', request.url);
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};
