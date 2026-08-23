import { readFile, writeFile } from 'node:fs/promises';
import { URL as NodeUrl, fileURLToPath } from 'node:url';

const rawSiteUrl = process.env.VITE_SITE_URL?.trim();

function productionUrl(value?: string): NodeUrl | null {
  if (!value) return null;
  try {
    const url = new NodeUrl(value);
    return url.protocol === 'https:' ? new NodeUrl('/', url) : null;
  } catch {
    return null;
  }
}

const siteUrl = productionUrl(rawSiteUrl);

if (!siteUrl) {
  console.log('SEO: VITE_SITE_URL ausente; canonical absoluto e sitemap serão gerados no deploy.');
  process.exit(0);
}

const indexPath = fileURLToPath(new NodeUrl('../dist/index.html', import.meta.url));
const robotsPath = fileURLToPath(new NodeUrl('../dist/robots.txt', import.meta.url));
const sitemapPath = fileURLToPath(new NodeUrl('../dist/sitemap.xml', import.meta.url));
const absoluteHome = siteUrl.toString();

const html = await readFile(indexPath, 'utf8');
const withCanonical = html
  .replace(/<link rel="canonical" data-runtime-canonical\s*\/?\s*>/, `<link rel="canonical" href="${absoluteHome}" data-runtime-canonical>`)
  .replace(/<meta property="og:site_name" content="KAD Concursos"\s*\/?\s*>/, `<meta property="og:site_name" content="KAD Concursos"><meta property="og:url" content="${absoluteHome}">`)
  .replace(/<meta property="og:image" data-runtime-social-image\s*\/?\s*>/, `<meta property="og:image" content="${new NodeUrl('/og.png', siteUrl)}" data-runtime-social-image>`)
  .replace(/<meta name="twitter:image" data-runtime-social-image\s*\/?\s*>/, `<meta name="twitter:image" content="${new NodeUrl('/og.png', siteUrl)}" data-runtime-social-image>`);
await writeFile(indexPath, withCanonical);

const publicPaths = ['/', '/termos', '/privacidade'];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPaths.map((path) => `  <url><loc>${new NodeUrl(path, siteUrl).toString()}</loc></url>`).join('\n')}
</urlset>
`;
await writeFile(sitemapPath, sitemap);

const robots = await readFile(robotsPath, 'utf8');
await writeFile(robotsPath, `${robots.trim()}\n\nSitemap: ${new NodeUrl('/sitemap.xml', siteUrl)}\n`);
console.log(`SEO: canonical e sitemap gerados para ${absoluteHome}`);
