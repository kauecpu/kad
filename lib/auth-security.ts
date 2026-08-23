export const MIN_PASSWORD_LENGTH = 12;
export const EMAIL_OTP_LENGTH = 6;
export const EMAIL_OTP_RESEND_SECONDS = 60;

export function normalizeEmailOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH);
}

export function isValidEmailOtp(value: string): boolean {
  return value.replace(/\D/g, '').length === EMAIL_OTP_LENGTH;
}

export type AuthCallbackKind = 'confirmation' | 'recovery';

export type AuthCallbackOptions = {
  allowedSchemes?: string[];
  allowExpoGo?: boolean;
  webOrigin?: string;
};

const PKCE_FLOW_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

export function authCallbackKindFromUrl(
  url: string,
  options: AuthCallbackOptions = {}
): AuthCallbackKind | null {
  try {
    const parsed = new URL(url);
    const scheme = parsed.protocol.replace(':', '').toLowerCase();
    const allowedSchemes = options.allowedSchemes ?? ['kad'];
    let path = parsed.pathname.replace(/^\/+/, '');

    if (allowedSchemes.includes(scheme)) {
      if (parsed.hostname !== 'auth') return null;
      path = `${parsed.hostname}/${path}`;
    } else if ((scheme === 'exp' || scheme === 'exps') && options.allowExpoGo) {
      path = path.replace(/^--\//, '');
    } else if ((scheme === 'http' || scheme === 'https') && options.webOrigin) {
      if (parsed.origin !== options.webOrigin) return null;
    } else {
      return null;
    }

    path = path.replace(/^--\//, '').replace(/\/+$/, '');

    if (path === 'auth/nova-senha') return 'recovery';
    if (path === 'auth/login') return 'confirmation';
    return null;
  } catch {
    return null;
  }
}

export function authCodeFromUrl(url: string, options: AuthCallbackOptions = {}): {
  callback: AuthCallbackKind | null;
  code?: string;
  flowId?: string;
  errorDescription?: string;
} {
  const callback = authCallbackKindFromUrl(url, options);
  if (!callback) return { callback: null };

  try {
    const parsed = new URL(url);
    const flowId = parsed.searchParams.get('sb_flow_id');
    return {
      callback,
      code: parsed.searchParams.get('code') ?? undefined,
      flowId: flowId && PKCE_FLOW_ID_PATTERN.test(flowId) ? flowId : undefined,
      errorDescription:
        parsed.searchParams.get('error_description') ??
        parsed.searchParams.get('error') ??
        undefined,
    };
  } catch {
    return { callback };
  }
}

export function isAuthCallbackUrl(url: string, options: AuthCallbackOptions = {}): boolean {
  const { callback, code, flowId, errorDescription } = authCodeFromUrl(url, options);
  return Boolean(callback && ((code && flowId) || errorDescription));
}

export function createAuthCallbackReplayGuard() {
  const processed = new Set<string>();
  return {
    claim(url: string) {
      if (processed.has(url)) return false;
      processed.add(url);
      return true;
    },
  };
}
