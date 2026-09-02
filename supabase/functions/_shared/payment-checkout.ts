export type OpenCheckout = {
  id: string;
  plan: string;
  billing_cycle: string;
  provider_subscription_id: string | null;
  checkout_url: string | null;
  status: string;
  created_at: string;
  expires_at: string;
};

export type CheckoutAction = 'create' | 'reuse' | 'in_progress' | 'replace';

export type CheckoutFailureReason =
  | 'configuration_missing'
  | 'provider_credentials_rejected'
  | 'provider_request_rejected'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_invalid_response'
  | 'internal_error';

type SelectedPlan = {
  plan: string;
  billingCycle: string;
};

export function isTrustedCheckoutUrl(value: unknown): value is string {
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

export function decideCheckoutAction(
  openCheckout: OpenCheckout | null,
  selectedPlan: SelectedPlan,
  nowMs = Date.now()
): CheckoutAction {
  if (!openCheckout) return 'create';

  if (
    openCheckout.status === 'pending' &&
    new Date(openCheckout.expires_at).getTime() > nowMs &&
    openCheckout.plan === selectedPlan.plan &&
    openCheckout.billing_cycle === selectedPlan.billingCycle &&
    isTrustedCheckoutUrl(openCheckout.checkout_url)
  ) {
    return 'reuse';
  }

  const creatingAge = nowMs - new Date(openCheckout.created_at).getTime();
  if (openCheckout.status === 'creating' && creatingAge < 120_000) {
    return 'in_progress';
  }

  return 'replace';
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : '';
}

/** Reduz falhas internas a categorias seguras, sem persistir respostas ou segredos do provedor. */
export function classifyCheckoutFailure(value: unknown): CheckoutFailureReason {
  const message = errorMessage(value);
  if (
    message.includes(' is missing') ||
    message.includes(' is invalid') ||
    message.includes('must be explicitly configured') ||
    message.includes('must use HTTPS')
  ) {
    return 'configuration_missing';
  }
  if (message === 'Provider returned an invalid checkout') {
    return 'provider_invalid_response';
  }

  const status = typeof value === 'object' && value !== null && 'status' in value
    ? Number(value.status)
    : Number.NaN;
  if (status === 401 || status === 403) return 'provider_credentials_rejected';
  if (status === 400 || status === 404 || status === 409 || status === 422) {
    return 'provider_request_rejected';
  }
  if (status === 429) return 'provider_rate_limited';
  if (status >= 500 && status <= 599) return 'provider_unavailable';
  return 'internal_error';
}
