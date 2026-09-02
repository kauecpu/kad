import type { Subscription } from '../types/domain.ts';

export type RemoteSubscriptionRecord = {
  plan?: unknown;
  billing_cycle?: unknown;
  provider?: unknown;
  status?: unknown;
  started_at?: unknown;
  current_period_end?: unknown;
  cancel_at_period_end?: unknown;
};

const BASIC_SUBSCRIPTION: Subscription = {
  plan: 'basic',
  status: 'inactive',
  autoRenew: false,
};

function validDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

export function subscriptionHasAccess(
  subscription: Subscription,
  now = new Date()
): boolean {
  if (
    subscription.plan === 'basic' ||
    !subscription.renewsAt ||
    !['active', 'past_due', 'canceled'].includes(subscription.status)
  ) {
    return false;
  }
  const expiresAt = new Date(subscription.renewsAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function subscriptionPlanName(plan: Subscription['plan']): string {
  if (plan === 'platinum') return 'KAD Platina';
  if (plan === 'diamond') return 'KAD Diamond';
  if (plan === 'circle') return 'KAD Círculo';
  return 'Plano Básico';
}

/** Converte a linha remota em estado local sem preservar acesso vencido. */
export function subscriptionFromRemoteRecord(
  row: RemoteSubscriptionRecord | null,
  now = new Date()
): Subscription {
  if (!row) return { ...BASIC_SUBSCRIPTION };
  const plan = row.plan;
  const billingCycle = row.billing_cycle;
  const provider = row.provider;
  const status = row.status;
  if (
    (plan !== 'platinum' && plan !== 'diamond' && plan !== 'circle') ||
    (billingCycle !== 'monthly' && billingCycle !== 'quarterly' && billingCycle !== 'annual') ||
    (provider !== 'mercado_pago' && provider !== 'apple' && provider !== 'google') ||
    (status !== 'active' && status !== 'past_due' && status !== 'canceled' && status !== 'expired') ||
    !validDate(row.current_period_end)
  ) {
    return { ...BASIC_SUBSCRIPTION };
  }

  const currentStatus =
    ['active', 'past_due', 'canceled'].includes(status) &&
    new Date(row.current_period_end).getTime() <= now.getTime()
      ? 'expired'
      : status;
  return {
    plan,
    billingCycle,
    provider,
    status: currentStatus,
    startedAt: validDate(row.started_at) ? row.started_at : undefined,
    renewsAt: row.current_period_end,
    autoRenew:
      (currentStatus === 'active' || currentStatus === 'past_due') &&
      row.cancel_at_period_end !== true,
  };
}
