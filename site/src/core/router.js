const listeners = new Set();

function sameOriginUrl(target) {
  const url = new URL(target, globalThis.location?.origin ?? 'http://localhost');
  if (globalThis.location && url.origin !== globalThis.location.origin) return null;
  return url;
}
export function currentRoute() {
  const pathname = globalThis.location?.pathname?.replace(/\/+$/, '') || '/';
  return {
    pathname: pathname || '/',
    search: globalThis.location?.search ?? '',
    params: Object.fromEntries(new URLSearchParams(globalThis.location?.search ?? '')),
  };
}

export function navigate(target, { replace = false } = {}) {
  const url = sameOriginUrl(target);
  if (!url || !globalThis.history) return;
  globalThis.history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
  listeners.forEach((listener) => listener(currentRoute()));
  globalThis.scrollTo?.({ top: 0, behavior: 'instant' });
}

export function back() {
  globalThis.history?.back();
}

export function subscribeRouter(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

globalThis.addEventListener?.('popstate', () => {
  listeners.forEach((listener) => listener(currentRoute()));
});

export function matchRoute(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected.startsWith(':')) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return null;
  }
  return params;
}
