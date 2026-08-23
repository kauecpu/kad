const defaultDescription =
  'Estude para concursos com questões comentadas, simulados, trilhas, redação e acompanhamento de desempenho no KAD.';

function setMeta(selector: string, attribute: string, value: string): void {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

export function updateMetadata({ title, description = defaultDescription, indexable = false, path = '/' }: { title: string; description?: string; indexable?: boolean; path?: string }): void {
  const fullTitle = title === 'KAD Concursos' ? title : `${title} | KAD Concursos`;
  document.title = fullTitle;
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[name="robots"]', 'content', indexable ? 'index, follow' : 'noindex, nofollow');
  setMeta('meta[property="og:title"]', 'content', fullTitle);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[name="twitter:title"]', 'content', fullTitle);
  setMeta('meta[name="twitter:description"]', 'content', description);
  setMeta('link[rel="canonical"]', 'href', new URL(path || '/', globalThis.location.origin).toString());
  const socialImage = new URL('/og.png', globalThis.location.origin).toString();
  setMeta('meta[property="og:image"]', 'content', socialImage);
  setMeta('meta[name="twitter:image"]', 'content', socialImage);
}
