/**
 * Boundary for Google Play Billing.
 *
 * The native module is loaded lazily so web builds and Node-based tests do not
 * import React Native code. A purchase is deliberately not acknowledged here:
 * callers must verify it on the server and then call finishStorePurchase.
 */

import type { ProductSubscription, Purchase } from 'expo-iap';

export type BillingPlan = 'diamond' | 'circle';
export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export type StoreSubscription = {
  productId: string;
  displayName?: string;
  displayPrice?: string;
  /** Offer token required by Google Play for subscription purchases. */
  offerToken?: string;
};

export type StorePurchase = {
  productId: string;
  purchaseToken?: string;
  transactionId?: string | null;
  purchaseState?: 'pending' | 'purchased' | 'unknown';
};

export type BillingFailure = {
  ok: false;
  code: 'not_ready' | 'unavailable' | 'cancelled' | 'failed' | 'timeout';
  message: string;
};

export type BillingResult<T> = { ok: true; value: T } | BillingFailure;

/** SKUs must match products and base plans created in Google Play Console. */
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
    'Google Play Billing não está disponível neste ambiente. Use um Development Build Android e configure os produtos no Play Console.',
};

const CONNECTION_ERROR: BillingFailure = {
  ok: false,
  code: 'unavailable',
  message: 'Não foi possível conectar ao Google Play Billing.',
};

const PURCHASE_TIMEOUT_MS = 120_000;

type IapModule = typeof import('expo-iap');
type ListenerCleanup = { remove: () => void };
type PurchaseWaiter = {
  resolve: (result: BillingResult<StorePurchase>) => void;
  timer: ReturnType<typeof setTimeout>;
};

let iapModulePromise: Promise<IapModule | null> | null = null;
let connectionPromise: Promise<BillingResult<void>> | null = null;
let nativeListeners: ListenerCleanup[] = [];
const purchaseListeners = new Set<(purchase: StorePurchase) => void>();
const purchaseWaiters = new Map<string, PurchaseWaiter>();
const nativePurchases = new Map<string, Purchase>();

async function loadIap(): Promise<IapModule | null> {
  if (!iapModulePromise) {
    iapModulePromise = import('expo-iap').catch(() => null);
  }
  return iapModulePromise;
}

function failure(code: BillingFailure['code'], message: string): BillingFailure {
  return { ok: false, code, message };
}

function purchaseKey(purchase: StorePurchase): string | null {
  return purchase.purchaseToken || purchase.transactionId || null;
}

function toStorePurchase(purchase: Purchase): StorePurchase {
  const result: StorePurchase = {
    productId: purchase.productId,
    purchaseToken: purchase.purchaseToken ?? undefined,
    transactionId: purchase.transactionId,
    purchaseState: purchase.purchaseState,
  };
  const key = purchaseKey(result);
  if (key) nativePurchases.set(key, purchase);
  return result;
}

function notifyPurchase(purchase: Purchase) {
  const result = toStorePurchase(purchase);
  const waiter = purchaseWaiters.get(result.productId);
  if (waiter) {
    clearTimeout(waiter.timer);
    purchaseWaiters.delete(result.productId);
    waiter.resolve({ ok: true, value: result });
  }
  for (const listener of purchaseListeners) listener(result);
}

function notifyPurchaseError(error: { code?: string; message?: string; productId?: string | null }) {
  const productId = error.productId ?? undefined;
  const message = error.message || 'O Google Play Billing rejeitou a compra.';
  const code = error.code === 'user-cancelled' ? 'cancelled' : 'failed';
  const waiters = productId
    ? [[productId, purchaseWaiters.get(productId)] as const]
    : Array.from(purchaseWaiters.entries());
  for (const [key, waiter] of waiters) {
    if (!waiter) continue;
    clearTimeout(waiter.timer);
    purchaseWaiters.delete(key);
    waiter.resolve({ ok: false, code, message });
  }
}

async function ensureConnection(): Promise<BillingResult<void>> {
  const iap = await loadIap();
  if (!iap) return NOT_READY;
  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        await iap.initConnection();
        if (!nativeListeners.length) {
          nativeListeners = [
            iap.purchaseUpdatedListener(notifyPurchase),
            iap.purchaseErrorListener(notifyPurchaseError),
          ];
        }
        return { ok: true, value: undefined };
      } catch {
        connectionPromise = null;
        return CONNECTION_ERROR;
      }
    })();
  }
  return connectionPromise;
}

export async function initBilling(): Promise<BillingResult<void>> {
  return ensureConnection();
}

export async function endBilling(): Promise<BillingResult<void>> {
  const iap = await loadIap();
  if (!iap) return NOT_READY;
  for (const listener of nativeListeners) listener.remove();
  nativeListeners = [];
  for (const waiter of purchaseWaiters.values()) {
    clearTimeout(waiter.timer);
    waiter.resolve(failure('unavailable', 'A conexão com o Google Play Billing foi encerrada.'));
  }
  purchaseWaiters.clear();
  connectionPromise = null;
  try {
    await iap.endConnection();
    return { ok: true, value: undefined };
  } catch {
    return CONNECTION_ERROR;
  }
}

export async function fetchStoreSubscriptions(
  productIds: readonly string[],
): Promise<BillingResult<readonly StoreSubscription[]>> {
  const connected = await ensureConnection();
  if (!connected.ok) return connected;
  const iap = await loadIap();
  if (!iap) return NOT_READY;
  if (!productIds.length) return { ok: true, value: [] };
  try {
    const products = await iap.fetchProducts({ skus: [...productIds], type: 'subs' });
    const subscriptions = (products ?? []) as ProductSubscription[];
    return {
      ok: true,
      value: subscriptions.map((product) => ({
        productId: product.id,
        displayName: product.displayName ?? undefined,
        displayPrice: product.displayPrice,
        offerToken: product.subscriptionOffers?.[0]?.offerTokenAndroid ?? undefined,
      })),
    };
  } catch {
    return failure('failed', 'Não foi possível consultar os produtos do Google Play.');
  }
}

export async function requestStorePurchase(
  productId: string,
  offerToken?: string,
): Promise<BillingResult<StorePurchase>> {
  const connected = await ensureConnection();
  if (!connected.ok) return connected;
  const iap = await loadIap();
  if (!iap) return NOT_READY;
  if (purchaseWaiters.has(productId)) {
    return failure('failed', 'Já existe uma compra deste produto em andamento.');
  }

  const result = new Promise<BillingResult<StorePurchase>>((resolve) => {
    const timer = setTimeout(() => {
      purchaseWaiters.delete(productId);
      resolve(failure('timeout', 'A compra não foi confirmada pela Google Play no tempo esperado.'));
    }, PURCHASE_TIMEOUT_MS);
    purchaseWaiters.set(productId, { resolve, timer });
  });

  try {
    await iap.requestPurchase({
      type: 'subs',
      request: {
        google: {
          skus: [productId],
          subscriptionOffers: offerToken ? [{ sku: productId, offerToken }] : undefined,
        },
      },
    });
  } catch (error) {
    notifyPurchaseError({
      productId,
      code: (error as { code?: string })?.code,
      message: error instanceof Error ? error.message : undefined,
    });
  }
  return result;
}

/**
 * Finalizes a purchase only after the server has accepted its token. Calling
 * this before server validation can cause Google Play to refund the purchase.
 */
export async function finishStorePurchase(
  purchase: StorePurchase,
): Promise<BillingResult<void>> {
  const iap = await loadIap();
  if (!iap) return NOT_READY;
  const key = purchaseKey(purchase);
  const nativePurchase = key ? nativePurchases.get(key) : undefined;
  if (!nativePurchase) {
    return failure('failed', 'A compra não está disponível para finalização nesta sessão.');
  }
  try {
    await iap.finishTransaction({ purchase: nativePurchase, isConsumable: false });
    if (key) nativePurchases.delete(key);
    return { ok: true, value: undefined };
  } catch {
    return failure('failed', 'Não foi possível finalizar a compra na Google Play.');
  }
}

export async function restoreStorePurchases(): Promise<BillingResult<readonly StorePurchase[]>> {
  const connected = await ensureConnection();
  if (!connected.ok) return connected;
  const iap = await loadIap();
  if (!iap) return NOT_READY;
  try {
    await iap.restorePurchases();
    const purchases = await iap.getAvailablePurchases();
    return { ok: true, value: purchases.map(toStorePurchase) };
  } catch {
    return failure('failed', 'Não foi possível restaurar as compras da Google Play.');
  }
}

export function observeStorePurchases(
  listener: (purchase: StorePurchase) => void,
): () => void {
  purchaseListeners.add(listener);
  void ensureConnection();
  return () => {
    purchaseListeners.delete(listener);
  };
}
