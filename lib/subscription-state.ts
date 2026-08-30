import { DEFAULT_SUBSCRIPTION } from '../data/user.ts';
import type { BillingCycle, Subscription, SubscriptionPlan } from '../types/index.ts';
import { subscriptionHasAccess, subscriptionWithCurrentStatus } from './access-rules.ts';

export type RemoteSubscriptionRow = {
  plan: unknown;
  billing_cycle: unknown;
  provider: unknown;
  provider_status: unknown;
  status: unknown;
  started_at: unknown;
  current_period_end: unknown;
  cancel_at_period_end: unknown;
};

type SubscriptionLoadingState = {
  authLoading: boolean;
  userId: string | null;
  hydrated: boolean;
  checkedUserId: string | null;
  refreshing: boolean;
};

type VerifiedSubscriptionAccessState = {
  userId: string | null;
  loading: boolean;
  subscription: Subscription;
};

/** Mantém o acesso pendente até a primeira consulta do usuário atual terminar. */
export function subscriptionIsLoading({
  authLoading,
  userId,
  hydrated,
  checkedUserId,
  refreshing,
}: SubscriptionLoadingState): boolean {
  return authLoading || Boolean(userId && (!hydrated || checkedUserId !== userId || refreshing));
}

/** Nunca reaproveita o plano de outro usuário ou de uma sessão ainda não verificada. */
export function subscriptionHasVerifiedAccess({
  userId,
  loading,
  subscription,
}: VerifiedSubscriptionAccessState): boolean {
  return Boolean(userId && !loading && subscriptionHasAccess(subscription));
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return value === 'monthly' || value === 'quarterly' || value === 'annual';
}

function isPaidPlan(value: unknown): value is Exclude<SubscriptionPlan, 'basic'> {
  return value === 'platinum' || value === 'diamond' || value === 'circle';
}

function isProvider(value: unknown): value is NonNullable<Subscription['provider']> {
  return value === 'mercado_pago' || value === 'apple' || value === 'google';
}

function isSubscriptionStatus(value: unknown): value is Subscription['status'] {
  return (
    value === 'active' ||
    value === 'past_due' ||
    value === 'canceled' ||
    value === 'expired'
  );
}

function validIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

/** Converte a resposta não confiável do banco para o estado usado pelo app. */
export function subscriptionFromRemote(
  row: RemoteSubscriptionRow | null,
  now = new Date()
): Subscription {
  if (
    !row ||
    !isPaidPlan(row.plan) ||
    !isBillingCycle(row.billing_cycle) ||
    !isProvider(row.provider) ||
    !isSubscriptionStatus(row.status) ||
    !validIsoDate(row.started_at) ||
    !validIsoDate(row.current_period_end)
  ) {
    return DEFAULT_SUBSCRIPTION;
  }

  return subscriptionWithCurrentStatus(
    {
      plan: row.plan,
      billingCycle: row.billing_cycle,
      provider: row.provider,
      status: row.status,
      startedAt: row.started_at,
      renewsAt: row.current_period_end,
      autoRenew:
        (row.status === 'active' || row.status === 'past_due') &&
        row.cancel_at_period_end !== true,
    },
    now
  );
}

/** Reflete imediatamente um cancelamento confirmado, sem depender de nova leitura da rede. */
export function subscriptionAfterCancellation(subscription: Subscription): Subscription {
  return subscription.autoRenew ? { ...subscription, autoRenew: false } : subscription;
}
