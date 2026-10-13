export const CAPTCHA_MESSAGE = 'Não foi possível concluir a verificação de segurança. Tente novamente.';
export const CAPTCHA_EXPIRED_MESSAGE = 'A verificação de segurança expirou. Tente novamente.';

/** A challenge can outlive a logout/account switch; pin the destructive request. */
export async function captchaSessionAuthorization(expectedUserId: string, readSession: () => Promise<{
  data: { session: { user: { id: string }; access_token: string } | null }; error?: unknown;
}>): Promise<{ Authorization: string } | null> {
  try {
    const { data, error } = await readSession();
    if (error || data.session?.user.id !== expectedUserId || !data.session.access_token) return null;
    return { Authorization: `Bearer ${data.session.access_token}` };
  } catch { return null; }
}

export function captchaEnabled(value: unknown): boolean {
  if (value === undefined || value === '' || value === 'false' || value === false) return false;
  if (value === 'true' || value === true) return true;
  throw new Error('Invalid CAPTCHA configuration');
}

export function captchaPageUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('CAPTCHA URL missing');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/auth/captcha') {
    throw new Error('Invalid CAPTCHA URL');
  }
  return url.href;
}

/** Correlation protects message delivery; ONLY Supabase validates the token. */
export function captchaMessage(value: unknown, nonce: string): { token?: string; error?: string } | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (message.type !== 'kad-captcha' || message.nonce !== nonce) return null;
  if (message.error === 'expired') return { error: CAPTCHA_EXPIRED_MESSAGE };
  if (message.error === 'failed' || message.error === 'unavailable') return { error: CAPTCHA_MESSAGE };
  if (typeof message.token !== 'string' || !message.token || message.token.length > 2048) return null;
  return { token: message.token };
}

export function captchaAuthMessage(error: unknown): string | undefined {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 'captcha_failed') return CAPTCHA_MESSAGE;
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
  }
  return undefined;
}
