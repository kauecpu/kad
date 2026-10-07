import { recoveryFailure, type RecoveryFailure } from './password-recovery.ts';

const PKCE_FLOW_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

export type RecoveryCallback = { code: string; flowId: string };

export function parseRecoveryCallback(
  value: string,
  expectedOrigin: string,
): RecoveryCallback | null {
  try {
    const callback = new URL(value);
    if (callback.origin !== expectedOrigin || callback.pathname !== '/nova-senha') return null;
    if (callback.hash || callback.searchParams.has('access_token') || callback.searchParams.has('refresh_token')) {
      return null;
    }
    const code = callback.searchParams.get('code');
    const flowId = callback.searchParams.get('sb_flow_id');
    if (callback.searchParams.getAll('code').length !== 1 || callback.searchParams.getAll('sb_flow_id').length !== 1) return null;
    if (callback.searchParams.has('error') || callback.searchParams.has('error_code')) return null;
    if (!code || !flowId || !PKCE_FLOW_ID_PATTERN.test(flowId)) return null;
    return { code, flowId };
  } catch {
    return null;
  }
}

export function recoveryCallbackFailure(value: string, expectedOrigin: string): RecoveryFailure {
  try {
    const callback = new URL(value);
    if (callback.origin !== expectedOrigin || callback.pathname !== '/nova-senha') return 'invalid-link';
    // Read only an allowlisted error code. Never display error_description or accept fragment tokens.
    const fragment = new URLSearchParams(callback.hash.slice(1));
    const code = callback.searchParams.get('error_code') ?? fragment.get('error_code');
    if (code) return recoveryFailure({ code });
    if (!callback.search && !callback.hash) return 'interrupted';
    if (callback.searchParams.has('code') && !callback.searchParams.has('sb_flow_id')) return 'session-missing';
    return 'invalid-link';
  } catch {
    return 'invalid-link';
  }
}
