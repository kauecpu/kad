export type MercadoPagoWebhookBody = {
  id?: string | number;
  action?: string;
  type: string;
  live_mode?: boolean;
  data?: { id?: string | number };
};

const SUPPORTED_EVENT_TYPES = new Set([
  'subscription_preapproval',
  'subscription_authorized_payment',
  'payment',
  'topic_chargebacks_wh',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalResourceId(value: unknown): value is string | number | undefined {
  return (
    value === undefined ||
    (typeof value === 'string' && value.length > 0 && value.length <= 200) ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
  );
}

function isSafeEventLabel(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[A-Za-z0-9_.:-]+$/.test(value)
  );
}

/** Converte o payload externo em um formato estrito antes de qualquer gravação. */
export function parseMercadoPagoWebhookBody(value: unknown): MercadoPagoWebhookBody | null {
  if (!isRecord(value)) return null;
  if (!isSafeEventLabel(value.type, 80)) return null;
  const subscriptionTopic = value.type === 'subscription_preapproval'
    || value.type === 'subscription_authorized_payment';
  // Absence is not false: subscription handlers must resolve it from the API.
  if (typeof value.live_mode !== 'boolean' && !(subscriptionTopic && value.live_mode === undefined)) return null;
  if (!isOptionalResourceId(value.id)) return null;
  if (value.action !== undefined && !isSafeEventLabel(value.action, 120)) return null;
  if (value.data !== undefined) {
    if (!isRecord(value.data) || !isOptionalResourceId(value.data.id)) return null;
  }

  return value as MercadoPagoWebhookBody;
}

/** Never process an ID supplied only by the unsigned JSON body. */
export function signedWebhookResourceId(url: URL, body: MercadoPagoWebhookBody): string | null {
  const ids = [...url.searchParams.getAll('data.id'), ...url.searchParams.getAll('data_id')];
  const id = ids[0];
  if (!id || !/^[A-Za-z0-9_-]{1,200}$/.test(id) || ids.some((value) => value !== id)) return null;
  if (body.data?.id !== undefined && String(body.data.id).toLowerCase() !== id.toLowerCase()) return null;
  return id;
}

export function webhookStructureFailure(value: unknown): string {
  if (!isRecord(value)) return 'body_not_object';
  if (!isSafeEventLabel(value.type, 80)) return 'invalid_event_type';
  if (value.live_mode === undefined) return 'missing_environment';
  if (typeof value.live_mode !== 'boolean') return 'invalid_environment_type';
  if (!isOptionalResourceId(value.id)) return 'invalid_notification_id';
  if (value.action !== undefined && !isSafeEventLabel(value.action, 120)) return 'invalid_action';
  return 'invalid_resource_structure';
}

/** Uma configuração ausente ou inválida nunca aceita eventos de qualquer ambiente. */
export function webhookEnvironmentMatches(
  configuredLiveMode: string | undefined,
  eventLiveMode: unknown
): boolean {
  if (configuredLiveMode !== 'true' && configuredLiveMode !== 'false') return false;
  return eventLiveMode === (configuredLiveMode === 'true');
}

/** Eventos válidos, assinados, mas fora do contrato do KAD são ignorados sem gerar retentativas. */
export function isSupportedMercadoPagoEventType(value: string): boolean {
  return SUPPORTED_EVENT_TYPES.has(value);
}

export function checkoutMatchesProviderSubscription(
  checkoutProviderSubscriptionId: string | null,
  eventProviderSubscriptionId: string
): boolean {
  return (
    checkoutProviderSubscriptionId === null ||
    checkoutProviderSubscriptionId === eventProviderSubscriptionId
  );
}

export function webhookProcessingOutcome(correlated: boolean): {
  processed: boolean;
  errorCode: string | null;
} {
  return correlated
    ? { processed: true, errorCode: null }
    : { processed: false, errorCode: 'not_correlated' };
}

export function paymentStatusReason(providerStatus: string): string | null {
  if (providerStatus === 'rejected') return 'payment_rejected';
  if (providerStatus === 'refunded') return 'payment_refunded';
  if (providerStatus === 'charged_back') return 'payment_chargeback';
  return null;
}
