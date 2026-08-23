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
    if (!code || !flowId || !PKCE_FLOW_ID_PATTERN.test(flowId)) return null;
    return { code, flowId };
  } catch {
    return null;
  }
}
