import { FunctionsHttpError } from '@supabase/supabase-js';

import { DEFAULT_SUBSCRIPTION } from '@/data/user';
import {
  fetchStoreSubscriptions,
  finishStorePurchase,
  requestStorePurchase,
  restoreStorePurchases,
  type StorePurchase,
} from '@/lib/billing';
import { isTrustedPaymentCheckoutUrl } from '@/lib/payment-security';
import { subscriptionFromRemote } from '@/lib/subscription-state';
import { supabase } from '@/lib/supabase';
import type { BillingCycle, Subscription, SubscriptionPlan } from '@/types';

export type SubscriptionActionResult = {
  ok: boolean;
  message?: string;
  checkoutUrl?: string;
};

export type GooglePurchaseValidation = {
  ok: boolean;
  entitled: boolean;
  plan?: Exclude<SubscriptionPlan, 'basic' | 'circle'>;
  billingCycle?: BillingCycle;
  status?: Subscription['status'];
  currentPeriodEnd?: string;
  autoRenew?: boolean;
  message?: string;
};

export async function loadRemoteSubscription(userId: string): Promise<Subscription> {
  if (!supabase) return DEFAULT_SUBSCRIPTION;
  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      'plan, billing_cycle, provider, provider_status, status, started_at, current_period_end, cancel_at_period_end'
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return subscriptionFromRemote(data);
}

async function edgeFunctionErrorCode(error: unknown): Promise<string | undefined> {
  if (!(error instanceof FunctionsHttpError)) return undefined;
  try {
    const response = error.context as Response;
    const body = (await response.clone().json()) as { code?: unknown };
    return typeof body.code === 'string' ? body.code : undefined;
  } catch {
    return undefined;
  }
}

function checkoutErrorMessage(code?: string) {
  if (code === 'subscription_active') return 'Sua assinatura já possui acesso ativo.';
  if (code === 'checkout_in_progress') {
    return 'Seu checkout já está sendo preparado. Aguarde alguns segundos e tente novamente.';
  }
  if (code === 'unauthorized') return 'Entre novamente para assinar o KAD.';
  if (code === 'server_not_configured') {
    return 'Os pagamentos ainda não foram configurados para este ambiente.';
  }
  return 'Não foi possível abrir o pagamento agora. Tente novamente em instantes.';
}

export async function createSubscriptionCheckout(
  plan: Exclude<SubscriptionPlan, 'basic' | 'circle'>,
  billingCycle: BillingCycle
): Promise<SubscriptionActionResult> {
  if (!supabase) {
    return { ok: false, message: 'Entre em uma conta para assinar o KAD.' };
  }
  const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
    body: { plan, billingCycle },
  });
  if (error) {
    return { ok: false, message: checkoutErrorMessage(await edgeFunctionErrorCode(error)) };
  }
  if (!isTrustedPaymentCheckoutUrl(data?.checkoutUrl)) {
    return { ok: false, message: 'O provedor retornou um endereço de pagamento inválido.' };
  }
  return { ok: true, checkoutUrl: data.checkoutUrl };
}

export async function cancelRemoteSubscription(): Promise<SubscriptionActionResult> {
  if (!supabase) {
    return { ok: false, message: 'Entre novamente para gerenciar sua assinatura.' };
  }
  const { error } = await supabase.functions.invoke('cancel-subscription', { body: {} });
  if (!error) return { ok: true };
  const code = await edgeFunctionErrorCode(error);
  if (code === 'store_managed') {
    return { ok: false, message: 'Gerencie esta assinatura diretamente na loja do aparelho.' };
  }
  if (code === 'subscription_not_found') {
    return { ok: false, message: 'Não encontramos uma assinatura ativa nesta conta.' };
  }
  return {
    ok: false,
    message: 'Não foi possível cancelar a renovação agora. Tente novamente em instantes.',
  };
}

function googlePurchaseError(code?: string) {
  if (code === 'purchase_pending') return 'A compra está pendente na Google Play.';
  if (code === 'invalid_purchase') return 'A Google Play não confirmou esta compra.';
  if (code === 'product_mismatch') return 'O produto comprado não corresponde ao plano escolhido.';
  if (code === 'server_not_configured') {
    return 'A validação da Google Play ainda não foi configurada neste ambiente.';
  }
  return 'Não foi possível validar a compra na Google Play.';
}

async function invokeGoogleValidation(purchase: StorePurchase): Promise<GooglePurchaseValidation> {
  if (!supabase) {
    return { ok: false, entitled: false, message: 'Entre em uma conta para assinar o KAD.' };
  }
  if (!purchase.purchaseToken) {
    return { ok: false, entitled: false, message: 'A Google Play não forneceu um token de compra.' };
  }
  const { data, error } = await supabase.functions.invoke('validate-google-purchase', {
    body: {
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
    },
  });
  if (error) {
    return { ok: false, entitled: false, message: googlePurchaseError(await edgeFunctionErrorCode(error)) };
  }
  if (!data || data.ok !== true) {
    return {
      ok: false,
      entitled: false,
      message: googlePurchaseError(typeof data?.code === 'string' ? data.code : undefined),
    };
  }
  return data as GooglePurchaseValidation;
}

type GooglePurchaseActionResult = SubscriptionActionResult & {
  validation?: GooglePurchaseValidation;
};

const purchaseSettlements = new Map<string, Promise<GooglePurchaseActionResult>>();

function purchaseIdentity(purchase: StorePurchase) {
  return purchase.purchaseToken || purchase.transactionId || `${purchase.productId}:unknown`;
}

/** Validates and acknowledges one purchase, coalescing duplicate store events. */
export function settleGooglePurchase(purchase: StorePurchase): Promise<GooglePurchaseActionResult> {
  const identity = purchaseIdentity(purchase);
  const existing = purchaseSettlements.get(identity);
  if (existing) return existing;

  const operation = (async (): Promise<GooglePurchaseActionResult> => {
    if (purchase.purchaseState === 'pending') {
      return { ok: false, message: 'A compra está pendente na Google Play.' };
    }
    const validation = await invokeGoogleValidation(purchase);
    if (!validation.ok) return { ok: false, message: validation.message, validation };
    const finished = await finishStorePurchase(purchase);
    if (!finished.ok) return finished;
    return { ok: true, validation };
  })().finally(() => {
    purchaseSettlements.delete(identity);
  });
  purchaseSettlements.set(identity, operation);
  return operation;
}

export async function purchaseGoogleSubscription(
  productId: string,
): Promise<SubscriptionActionResult & { validation?: GooglePurchaseValidation }> {
  const products = await fetchStoreSubscriptions([productId]);
  if (!products.ok) return products;
  const offerToken = products.value.find((product) => product.productId === productId)?.offerToken;
  const purchase = await requestStorePurchase(productId, offerToken);
  if (!purchase.ok) return purchase;
  return settleGooglePurchase(purchase.value);
}

export async function restoreGoogleSubscriptions(): Promise<
  SubscriptionActionResult & { restored: number; entitled: number }
> {
  const restored = await restoreStorePurchases();
  if (!restored.ok) return { ...restored, restored: 0, entitled: 0 };
  let entitled = 0;
  let processed = 0;
  for (const purchase of restored.value) {
    const result = await settleGooglePurchase(purchase);
    if (!result.ok || !result.validation) continue;
    processed += 1;
    if (result.validation.entitled) entitled += 1;
  }
  return { ok: true, restored: processed, entitled };
}
