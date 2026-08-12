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
