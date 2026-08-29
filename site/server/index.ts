export default {
  fetch(request: Request, env: { ASSETS: { fetch(request: Request): Promise<Response> } }): Promise<Response> {
    const fallbackUrl = new URL('/', request.url);
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};
