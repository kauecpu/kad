/** Somente URLs HTTPS oficiais do provedor podem receber o usuário. */
export function isTrustedPaymentCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      (host === 'mercadopago.com' ||
        host.endsWith('.mercadopago.com') ||
        host === 'mercadopago.com.br' ||
        host.endsWith('.mercadopago.com.br'))
    );
  } catch {
    return false;
  }
}

/** Evita tratar parâmetros arbitrários da URL como retorno de um checkout real. */
export function isValidPaymentCheckoutReturnId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
