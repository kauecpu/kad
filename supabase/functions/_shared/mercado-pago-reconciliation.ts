import {
  amountInCents,
  checkoutIdFromReference,
} from './mercado-pago.ts';

export type PaymentReconciliationTarget = {
  checkoutId: string;
  providerSubscriptionId: string;
  amountCents: number;
  currency: string;
};

export type ReconciledProviderSubscription = {
  status: string;
  observedAt: string | null;
};

export type ReconciledAuthorizedPayment = {
  providerPaymentId: string;
  providerStatus: string;
  amountCents: number;
  currency: string;
  paidAt: string | null;
  providerObservedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeStatus(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value)
    ? value
    : null;
}

function safeId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const id = String(value);
  return id.length > 0 && id.length <= 160 ? id : null;
}

function safeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function matchesCheckoutReference(reference: unknown, checkoutId: string): boolean {
  return checkoutIdFromReference(reference) === checkoutId.toLowerCase();
}

export function authorizedPaymentsSearchPath(providerSubscriptionId: string): string {
  const query = new URLSearchParams({ preapproval_id: providerSubscriptionId });
  return `/authorized_payments/search?${query.toString()}`;
}

/** Valida a assinatura consultada diretamente no provedor antes de sincronizar estado. */
export function reconcileProviderSubscription(
  value: unknown,
  target: PaymentReconciliationTarget
): ReconciledProviderSubscription | null {
  if (!isRecord(value) || value.id !== target.providerSubscriptionId) return null;
  if (!matchesCheckoutReference(value.external_reference, target.checkoutId)) return null;
  const status = safeStatus(value.status);
  const recurring = isRecord(value.auto_recurring) ? value.auto_recurring : null;
  if (
    !status ||
    !recurring ||
    amountInCents(recurring.transaction_amount) !== target.amountCents ||
    recurring.currency_id !== target.currency
  ) {
    return null;
  }
  return { status, observedAt: safeTimestamp(value.last_modified) };
}

/**
 * Converte a busca de faturas em pagamentos estritos. Faturas ainda agendadas não
 * geram crédito; qualquer divergência de correlação invalida a resposta inteira.
 */
export function reconcileAuthorizedPayments(
  value: unknown,
  target: PaymentReconciliationTarget
): ReconciledAuthorizedPayment[] | null {
  if (!isRecord(value) || !Array.isArray(value.results)) return null;
  const payments: ReconciledAuthorizedPayment[] = [];

  for (const result of value.results) {
    if (!isRecord(result)) return null;
    if (result.preapproval_id !== target.providerSubscriptionId) return null;
    if (!matchesCheckoutReference(result.external_reference, target.checkoutId)) return null;
    if (
      amountInCents(result.transaction_amount) !== target.amountCents ||
      result.currency_id !== target.currency
    ) {
      return null;
    }

    const payment = isRecord(result.payment) ? result.payment : null;
    if (!payment) continue;
    const providerPaymentId = safeId(payment.id);
    const providerStatus = safeStatus(payment.status);
    if (!providerPaymentId || !providerStatus) return null;
    payments.push({
      providerPaymentId,
      providerStatus,
      amountCents: target.amountCents,
      currency: target.currency,
      paidAt: safeTimestamp(result.debit_date),
      providerObservedAt:
        safeTimestamp(result.last_modified) ?? safeTimestamp(result.date_created),
    });
  }

  return payments.sort((left, right) => {
    const leftTime = left.providerObservedAt ? new Date(left.providerObservedAt).getTime() : 0;
    const rightTime = right.providerObservedAt ? new Date(right.providerObservedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}
