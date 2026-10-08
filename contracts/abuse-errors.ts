/** Shared presentation only: enforcement lives in the backend. No automatic retries. */
export function abuseErrorMessage(code: unknown, retryAfter?: unknown): string | undefined {
  if (code === 'captcha_failed') return 'Não foi possível concluir a verificação de segurança. Tente novamente.';
  if (code === 'rate_limited' || code === 'checkout_rate_limited' || code === 'checkout_refresh_rate_limited') {
    const seconds = typeof retryAfter === 'string' && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
    return seconds > 0 && seconds <= 86400
      ? `Muitas tentativas. Aguarde ${seconds} segundos antes de tentar novamente.`
      : 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
  }
  if (code === 'abuse_protection_unavailable') return 'Não foi possível verificar o limite de tentativas. Tente novamente mais tarde.';
  if (code === 'payload_too_large') return 'Os dados enviados ultrapassam o tamanho permitido.';
  return undefined;
}

export async function edgeAbuseMessage(error: unknown): Promise<string | undefined> {
  const response = error && typeof error === 'object' && 'context' in error ? error.context : undefined;
  if (!(response instanceof Response)) return undefined;
  try {
    const body = await response.clone().json() as { code?: unknown };
    return abuseErrorMessage(body.code, response.headers.get('Retry-After'));
  } catch { return undefined; }
}
