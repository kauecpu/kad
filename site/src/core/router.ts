import type { AuthMode, Route } from '../types/domain.ts';

const listeners = new Set<(route: Route) => void>();

function sameOriginUrl(target: string | URL): URL | null {
  const url = new URL(target, globalThis.location?.origin ?? 'http://localhost');
  if (globalThis.location && url.origin !== globalThis.location.origin) return null;
  return url;
}
export function currentRoute(): Route {
  const pathname = globalThis.location?.pathname?.replace(/\/+$/, '') || '/';
  return {
    pathname: pathname || '/',
    search: globalThis.location?.search ?? '',
    params: Object.fromEntries(new URLSearchParams(globalThis.location?.search ?? '')),
  };
}

export function shouldOpenStudyHome(pathname: string, state?: {
  auth?: { mode?: AuthMode };
  preferences?: { hasStarted?: boolean };
} | null): boolean {
  return pathname === '/'
    && (state?.auth?.mode === 'authenticated' || state?.preferences?.hasStarted === true);
}

export function navigate(target: string | URL, { replace = false }: { replace?: boolean } = {}): void {
  const url = sameOriginUrl(target);
  if (!url || !globalThis.history) return;
  globalThis.history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
  listeners.forEach((listener) => listener(currentRoute()));
  globalThis.scrollTo?.({ top: 0, behavior: 'instant' });
}

export function back(): void {
  globalThis.history?.back();
}

export function subscribeRouter(listener: (route: Route) => void): () => boolean {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

globalThis.addEventListener?.('popstate', () => {
  listeners.forEach((listener) => listener(currentRoute()));
});

export function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected?.startsWith(':') && actual !== undefined) {
      try {
        params[expected.slice(1)] = decodeURIComponent(actual);
      } catch (error) {
        if (error instanceof URIError) return null;
        throw error;
      }
    }
    else if (expected !== actual) return null;
  }
  return params;
}
