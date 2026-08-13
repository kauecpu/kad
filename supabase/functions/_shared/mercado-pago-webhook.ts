export type MercadoPagoWebhookBody = {
  id?: string | number;
  action?: string;
  type: string;
  live_mode: boolean;
  data?: { id?: string | number };
};

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
  if (!isSafeEventLabel(value.type, 80) || typeof value.live_mode !== 'boolean') return null;
  if (!isOptionalResourceId(value.id)) return null;
  if (value.action !== undefined && !isSafeEventLabel(value.action, 120)) return null;
  if (value.data !== undefined) {
    if (!isRecord(value.data) || !isOptionalResourceId(value.data.id)) return null;
  }

  return value as MercadoPagoWebhookBody;
}

/** Uma configuração ausente ou inválida nunca aceita eventos de qualquer ambiente. */
export function webhookEnvironmentMatches(
  configuredLiveMode: string | undefined,
  eventLiveMode: boolean
): boolean {
  if (configuredLiveMode !== 'true' && configuredLiveMode !== 'false') return false;
  return eventLiveMode === (configuredLiveMode === 'true');
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
