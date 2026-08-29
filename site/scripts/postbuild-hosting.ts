import { mkdir, writeFile } from 'node:fs/promises';
import { URL as NodeUrl, fileURLToPath } from 'node:url';

const serverDirectory = fileURLToPath(new NodeUrl('../dist/server/', import.meta.url));
const workerPath = fileURLToPath(new NodeUrl('../dist/server/index.js', import.meta.url));

const worker = `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== 'GET') return response;

    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    if (!acceptsHtml) return response;

    const fallbackUrl = new URL('/index.html', request.url);
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};
`;

await mkdir(serverDirectory, { recursive: true });
await writeFile(workerPath, worker);
console.log('Hosting: worker estático e fallback de SPA gerados.');
