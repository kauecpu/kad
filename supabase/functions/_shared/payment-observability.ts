export type PaymentFailureContext = {
  operation: 'checkout_create' | 'checkout_reconcile' | 'subscription_cancel' | 'webhook_process';
  category: string;
  startedAt: number;
  checkoutId?: string | null;
  eventType?: string | null;
  providerStatus?: number;
  providerCode?: string;
};

function safeLabel(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value)
    ? value
    : fallback;
}

function safeCheckoutId(value: unknown): string | undefined {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
}

/** Gera apenas telemetria técnica permitida; nunca inclui payload, token, e-mail ou mensagem externa. */
export function paymentFailureDetails(context: PaymentFailureContext) {
  const checkoutId = safeCheckoutId(context.checkoutId);
  const eventType = context.eventType
    ? safeLabel(context.eventType, 'invalid_event_type')
    : undefined;
  const providerStatus = Number.isInteger(context.providerStatus) &&
    Number(context.providerStatus) >= 100 && Number(context.providerStatus) <= 599
    ? Number(context.providerStatus)
    : undefined;
  const providerCode = context.providerCode
    ? safeLabel(context.providerCode, 'invalid_provider_code')
    : undefined;
  return {
    operation: context.operation,
    category: safeLabel(context.category, 'internal_error'),
    durationMs: Math.max(0, Math.round(Date.now() - context.startedAt)),
    ...(checkoutId ? { checkoutId } : {}),
    ...(eventType ? { eventType } : {}),
    ...(providerStatus ? { providerStatus } : {}),
    ...(providerCode ? { providerCode } : {}),
  };
}

export function logPaymentFailure(context: PaymentFailureContext): void {
  console.error('payment operation failed', paymentFailureDetails(context));
}
