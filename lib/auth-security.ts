export const MIN_PASSWORD_LENGTH = 12;

export type AuthCallbackKind = 'confirmation' | 'recovery';

export function authCallbackKindFromUrl(url: string): AuthCallbackKind | null {
  try {
    const parsed = new URL(url);
    const scheme = parsed.protocol.replace(':', '').toLowerCase();
    let path = parsed.pathname.replace(/^\/+/, '');

    if (scheme === 'kad' && parsed.hostname) {
      path = `${parsed.hostname}/${path}`;
    }

    path = path.replace(/^--\//, '').replace(/\/+$/, '');

    if (path === 'auth/nova-senha') return 'recovery';
    if (path === 'auth/login') return 'confirmation';
    return null;
  } catch {
    return null;
  }
}

export function authCodeFromUrl(url: string): {
  callback: AuthCallbackKind | null;
  code?: string;
  errorDescription?: string;
} {
  const callback = authCallbackKindFromUrl(url);
  if (!callback) return { callback: null };

  try {
    const parsed = new URL(url);
    return {
      callback,
      code: parsed.searchParams.get('code') ?? undefined,
      errorDescription:
        parsed.searchParams.get('error_description') ??
        parsed.searchParams.get('error') ??
        undefined,
    };
  } catch {
    return { callback };
  }
}
