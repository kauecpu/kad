import { FunctionsHttpError } from '@supabase/supabase-js';

import { DEFAULT_SUBSCRIPTION } from '@/data/user';
import { isTrustedPaymentCheckoutUrl } from '@/lib/payment-security';
import { subscriptionFromRemote } from '@/lib/subscription-state';
import { supabase } from '@/lib/supabase';
import type { BillingCycle, Subscription, SubscriptionPlan } from '@/types';

export type SubscriptionActionResult = {
  ok: boolean;
  message?: string;
  checkoutUrl?: string;
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
  plan: Exclude<SubscriptionPlan, 'basic'>,
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
