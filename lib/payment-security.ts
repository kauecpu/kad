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
