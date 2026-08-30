export type GooglePlan = 'platinum' | 'diamond';
export type GoogleCycle = 'monthly' | 'quarterly' | 'annual';
export type GoogleLineItem = {
  productId?: string;
  expiryTime?: string;
  autoRenewingPlan?: { autoRenewEnabled?: boolean };
  latestSuccessfulOrderId?: string;
};
export type GooglePurchase = {
  subscriptionState?: string;
  lineItems?: GoogleLineItem[];
};

export const GOOGLE_PRODUCT_CATALOG: Readonly<Record<string, readonly [GooglePlan, GoogleCycle]>> = {
  kad_platinum_monthly: ['platinum', 'monthly'],
  kad_platinum_quarterly: ['platinum', 'quarterly'],
  kad_platinum_annual: ['platinum', 'annual'],
  kad_diamond_monthly: ['diamond', 'monthly'],
  kad_diamond_quarterly: ['diamond', 'quarterly'],
  kad_diamond_annual: ['diamond', 'annual'],
};

export type GooglePurchaseClassification =
  | { ok: false; code: 'invalid_request' | 'product_mismatch' | 'purchase_pending' }
  | {
      ok: true;
      plan: GooglePlan;
      billingCycle: GoogleCycle;
      status: 'active' | 'past_due' | 'canceled' | 'expired';
      entitled: boolean;
      expiresAt: string | null;
      autoRenew: boolean;
      orderId: string | null;
    };

export function classifyGooglePurchase(
  purchase: GooglePurchase,
  requestedProductId: string,
  now = new Date(),
): GooglePurchaseClassification {
  const catalogEntry = GOOGLE_PRODUCT_CATALOG[requestedProductId];
  if (!catalogEntry) return { ok: false, code: 'invalid_request' };
  const lineItem = purchase.lineItems?.find((item) => item.productId === requestedProductId);
  if (!lineItem) return { ok: false, code: 'product_mismatch' };

  const expiry = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
  const expiryMs = expiry?.getTime() ?? Number.NaN;
  const hasValidExpiry = Number.isFinite(expiryMs);
  const expired = !hasValidExpiry || expiryMs <= now.getTime()
    || purchase.subscriptionState === 'SUBSCRIPTION_STATE_EXPIRED';
  if (purchase.subscriptionState === 'SUBSCRIPTION_STATE_PENDING') {
    return { ok: false, code: 'purchase_pending' };
  }

  let status: 'active' | 'past_due' | 'canceled' | 'expired';
  let entitled = true;
  let autoRenew = lineItem.autoRenewingPlan?.autoRenewEnabled === true;
  if (expired) {
    status = 'expired';
    entitled = false;
    autoRenew = false;
  } else if (purchase.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED') {
    status = 'canceled';
    autoRenew = false;
  } else if (
    purchase.subscriptionState === 'SUBSCRIPTION_STATE_ON_HOLD'
    || purchase.subscriptionState === 'SUBSCRIPTION_STATE_PAUSED'
  ) {
    status = 'past_due';
    autoRenew = false;
  } else {
    status = 'active';
  }

  return {
    ok: true,
    plan: catalogEntry[0],
    billingCycle: catalogEntry[1],
    status,
    entitled,
    expiresAt: hasValidExpiry && expiry ? expiry.toISOString() : null,
    autoRenew,
    orderId: lineItem.latestSuccessfulOrderId ?? null,
  };
}
