declare const Deno: { env: { get(name: string): string | undefined } };

export type PaidPlan = 'platinum' | 'diamond';
export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export type PaymentPlan = {
  plan: PaidPlan;
  billingCycle: BillingCycle;
  title: string;
  amountCents: number;
  frequency: number;
  frequencyType: 'months';
};

export const PAYMENT_PLANS: Record<PaidPlan, Record<BillingCycle, PaymentPlan>> = {
  platinum: {
    monthly: {
      plan: 'platinum',
      billingCycle: 'monthly',
      title: 'KAD Platina mensal',
      amountCents: 1499,
      frequency: 1,
      frequencyType: 'months',
    },
    quarterly: {
      plan: 'platinum',
      billingCycle: 'quarterly',
      title: 'KAD Platina trimestral',
      amountCents: 3999,
      frequency: 3,
      frequencyType: 'months',
    },
    annual: {
      plan: 'platinum',
      billingCycle: 'annual',
      title: 'KAD Platina anual',
      amountCents: 14999,
      frequency: 12,
      frequencyType: 'months',
    },
  },
  diamond: {
    monthly: {
      plan: 'diamond',
      billingCycle: 'monthly',
      title: 'KAD Diamante mensal',
      amountCents: 1499,
      frequency: 1,
      frequencyType: 'months',
    },
    quarterly: {
      plan: 'diamond',
      billingCycle: 'quarterly',
      title: 'KAD Diamante trimestral',
      amountCents: 3999,
      frequency: 3,
      frequencyType: 'months',
    },
    annual: {
      plan: 'diamond',
      billingCycle: 'annual',
      title: 'KAD Diamante anual',
      amountCents: 14999,
      frequency: 12,
      frequencyType: 'months',
    },
  },
};

const MERCADO_PAGO_API_URL = 'https://api.mercadopago.com';
const CHECKOUT_REFERENCE_PREFIX = 'kad_checkout:';
const MERCADO_PAGO_REQUEST_TIMEOUT_MS = 8_000;

export class MercadoPagoApiError extends Error {
  readonly status: number;
  readonly providerCode?: string;

  constructor(status: number, providerCode?: string) {
    super(`Mercado Pago request failed with status ${status}`);
    this.status = status;
    this.providerCode = providerCode;
  }
}

export class MercadoPagoTimeoutError extends Error {
  constructor() {
    super('Mercado Pago request timed out');
    this.name = 'MercadoPagoTimeoutError';
  }
}
function safeProviderCode(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z0-9_.:\-]{1,80}$/.test(value)
    ? value
    : undefined;
}

export function paymentPlan(
  plan: unknown,
  billingCycle: unknown
): PaymentPlan | null {
  if (plan !== 'platinum' && plan !== 'diamond') return null;
  if (
    billingCycle !== 'monthly' &&
    billingCycle !== 'quarterly' &&
    billingCycle !== 'annual'
  ) {
    return null;
  }
  return PAYMENT_PLANS[plan][billingCycle];
}

export function checkoutReference(checkoutId: string) {
  return `${CHECKOUT_REFERENCE_PREFIX}${checkoutId}`;
}

export function checkoutIdFromReference(reference: unknown): string | null {
  if (typeof reference !== 'string' || !reference.startsWith(CHECKOUT_REFERENCE_PREFIX)) {
    return null;
  }
  const checkoutId = reference.slice(CHECKOUT_REFERENCE_PREFIX.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    checkoutId
  )
    ? checkoutId.toLowerCase()
    : null;
}

export function amountInCents(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function isMercadoPagoTestPayerEmail(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@testuser\.com$/i.test(value);
}

export function buildPaymentReturnUrl(
  configured: string | undefined,
  checkoutId: string,
  liveMode: boolean
): string {
  if (!configured) throw new Error('KAD_WEB_APP_URL is missing');
  const url = new URL(configured);
  const localDevelopment =
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && !liveMode;
  if (url.protocol !== 'https:' && !localDevelopment) {
    throw new Error('KAD_WEB_APP_URL must use HTTPS');
  }
  url.pathname = `${url.pathname.replace(/\/$/, '')}/perfil/planos`;
  url.search = '';
  url.hash = '';
  url.searchParams.set('checkout', checkoutId);
  return url.toString();
}

export function paymentReturnUrl(checkoutId: string): string {
  return buildPaymentReturnUrl(
    Deno.env.get('KAD_WEB_APP_URL')?.trim(),
    checkoutId,
    Deno.env.get('MERCADO_PAGO_LIVE_MODE') === 'true'
  );
}

export function paymentWebhookUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is missing');
  return `${supabaseUrl}/functions/v1/mercado-pago-webhook`;
}

export async function mercadoPagoRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = MERCADO_PAGO_REQUEST_TIMEOUT_MS
): Promise<T> {
  const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')?.trim();
  if (!accessToken) throw new Error('MERCADO_PAGO_ACCESS_TOKEN is missing');

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
  const abortFromCaller = () => timeoutController.abort();
  init.signal?.addEventListener('abort', abortFromCaller, { once: true });
  let response: Response;
  let body: { code?: unknown; error?: unknown } | null;
  try {
    response = await fetch(`${MERCADO_PAGO_API_URL}${path}`, {
      ...init,
      signal: timeoutController.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    try {
      body = await response.json() as { code?: unknown; error?: unknown } | null;
    } catch (error) {
      if (timeoutController.signal.aborted) throw error;
      body = null;
    }
  } catch (error) {
    if (timeoutController.signal.aborted && !init.signal?.aborted) {
      throw new MercadoPagoTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
  if (!response.ok) {
    throw new MercadoPagoApiError(
      response.status,
      safeProviderCode(body?.code) ?? safeProviderCode(body?.error)
    );
  }
  return body as T;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function validateWebhookSignature({
  signature,
  requestId,
  dataId,
  secret,
}: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}) {
  if (!signature || !secret) return false;
  const values = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    })
  );
  const timestamp = values.ts;
  const expectedHash = values.v1?.toLowerCase();
  if (!timestamp || !expectedHash || !/^[0-9a-f]{64}$/.test(expectedHash)) return false;

  const manifest = [
    dataId ? `id:${dataId.toLowerCase()};` : '',
    requestId ? `request-id:${requestId};` : '',
    `ts:${timestamp};`,
  ].join('');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
  return constantTimeEqual(bytesToHex(signatureBytes), expectedHash);
}
