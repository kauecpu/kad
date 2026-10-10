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
  if (!Object.hasOwn(GOOGLE_PRODUCT_CATALOG, requestedProductId)) return { ok: false, code: 'invalid_request' };
  const catalogEntry = GOOGLE_PRODUCT_CATALOG[requestedProductId];
  const lineItem = purchase.lineItems?.find((item) => item.productId === requestedProductId);
  if (!lineItem) return { ok: false, code: 'product_mismatch' };

  const expiry = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
  const expiryMs = expiry?.getTime() ?? Number.NaN;
  const hasValidExpiry = Number.isFinite(expiryMs);
  // A future expiry alone is not an entitlement. Account hold is not grace.
  // Unknown states fail closed using the existing non-entitled contract, so a
  // previously linked purchase can also have its stale access revoked by the RPC.
  const entitledState = [
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    'SUBSCRIPTION_STATE_CANCELED',
  ].includes(purchase.subscriptionState ?? '');
  const expired = !hasValidExpiry || expiryMs <= now.getTime() || !entitledState;
  if (purchase.subscriptionState === 'SUBSCRIPTION_STATE_PENDING') {
    return { ok: false, code: 'purchase_pending' };
  }

  let status: 'active' | 'past_due' | 'canceled' | 'expired';
  let entitled = false;
  let autoRenew = lineItem.autoRenewingPlan?.autoRenewEnabled === true;
  if (expired) {
    status = 'expired';
    entitled = false;
    autoRenew = false;
  } else if (purchase.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED') {
    status = 'canceled';
    entitled = true;
    autoRenew = false;
  } else if (purchase.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE'
    || purchase.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') {
    status = 'active';
    entitled = true;
  } else {
    // Persist a negative validation instead of leaving previous access active.
    status = 'expired';
    autoRenew = false;
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
