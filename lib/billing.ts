/**
 * Boundary for the future native store billing integration.
 *
 * This module intentionally has no side effects and is not imported by the UI yet.
 * Store products, receipt verification and entitlement reconciliation must be
 * validated in a Development Build before these operations are enabled.
 */

export type BillingPlan = 'diamond' | 'circle';
export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export type StoreSubscription = {
  productId: string;
  displayName?: string;
  displayPrice?: string;
};

export type StorePurchase = {
  productId: string;
  purchaseToken?: string;
  transactionId?: string | null;
};

export type BillingFailure = {
  ok: false;
  code: 'not_ready';
  message: string;
};

export type BillingResult<T> = { ok: true; value: T } | BillingFailure;

/** Placeholder SKUs; they must match products created in Google Play Console. */
export const ANDROID_PRODUCT_IDS: Readonly<
  Record<BillingPlan, Readonly<Record<BillingCycle, string>>>
> = {
  diamond: {
    monthly: 'kad_diamond_monthly',
    quarterly: 'kad_diamond_quarterly',
    annual: 'kad_diamond_annual',
  },
  circle: {
    monthly: 'kad_circle_monthly',
    quarterly: 'kad_circle_quarterly',
    annual: 'kad_circle_annual',
  },
};

const NOT_READY: BillingFailure = {
  ok: false,
  code: 'not_ready',
  message:
    'Google Play Billing ainda não está habilitado: valide expo-iap em um Development Build, configure os produtos e implemente a validação server-side antes de usar esta operação.',
};

export async function initBilling(): Promise<BillingFailure> {
  return NOT_READY;
}

export async function endBilling(): Promise<BillingFailure> {
  return NOT_READY;
}

export async function fetchStoreSubscriptions(
  _productIds: readonly string[],
): Promise<BillingResult<readonly StoreSubscription[]>> {
  return NOT_READY;
}

export async function requestStorePurchase(
  _productId: string,
): Promise<BillingResult<StorePurchase>> {
  return NOT_READY;
}

/**
 * Registers no native listener until the store flow and server validation are ready.
 * The returned cleanup function keeps the eventual call sites idempotent.
 */
export function observeStorePurchases(
  _listener: (purchase: StorePurchase) => void,
): () => void {
  return () => undefined;
}
