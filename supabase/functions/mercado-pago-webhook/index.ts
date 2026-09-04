import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  amountInCents,
  checkoutIdFromReference,
  mercadoPagoRequest,
  mercadoPagoAccountMode,
  validateWebhookSignature,
} from '../_shared/mercado-pago.ts';
import {
  checkoutMatchesProviderSubscription,
  isSupportedMercadoPagoEventType,
  parseMercadoPagoWebhookBody,
  signedWebhookResourceId,
  webhookStructureFailure,
  webhookProcessingOutcome,
  webhookEnvironmentMatches,
} from '../_shared/mercado-pago-webhook.ts';
import { logPaymentFailure } from '../_shared/payment-observability.ts';

type CheckoutRow = {
  id: string;
  provider_subscription_id: string | null;
};

type MercadoPagoPreapproval = {
  id?: unknown;
  collector_id?: unknown;
  live_mode?: unknown;
  external_reference?: unknown;
  status?: unknown;
  last_modified?: unknown;
  auto_recurring?: {
    transaction_amount?: unknown;
    currency_id?: unknown;
  };
};

type MercadoPagoAuthorizedPayment = {
  id?: unknown;
  preapproval_id?: unknown;
  external_reference?: unknown;
  transaction_amount?: unknown;
  currency_id?: unknown;
  debit_date?: unknown;
  date_created?: unknown;
  last_modified?: unknown;
  payment?: { id?: unknown; status?: unknown };
};

type MercadoPagoPayment = {
  id?: unknown;
  collector_id?: unknown;
  live_mode?: unknown;
  external_reference?: unknown;
  transaction_amount?: unknown;
  currency_id?: unknown;
  status?: unknown;
  date_approved?: unknown;
  date_created?: unknown;
  date_last_updated?: unknown;
};

type MercadoPagoChargeback = {
  id?: unknown;
  payments?: unknown;
};

class WebhookEnvironmentError extends Error {}

type ProviderContext = { sellerId: string; liveMode: boolean | undefined };

async function providerContext(liveMode: boolean | undefined): Promise<ProviderContext> {
  const mode = mercadoPagoAccountMode(Deno.env.get('MERCADO_PAGO_ACCOUNT_MODE'), Deno.env.get('MERCADO_PAGO_LIVE_MODE'));
  const seller = await mercadoPagoRequest<{ id?: unknown; tags?: unknown }>('/users/me');
  if (!seller.id || !Array.isArray(seller.tags)
    || seller.tags.includes('test_user') !== (mode === 'test')) throw new Error('Provider account mismatch');
  return { sellerId: String(seller.id), liveMode };
}

function verifyProviderResource(resource: { collector_id?: unknown; live_mode?: unknown }, context: ProviderContext) {
  if (String(resource.collector_id) !== context.sellerId) throw new Error('Provider seller mismatch');
  const liveMode = resource.live_mode ?? context.liveMode;
  if (typeof liveMode !== 'boolean') throw new WebhookEnvironmentError('environment_unverifiable');
  if (!webhookEnvironmentMatches(Deno.env.get('MERCADO_PAGO_LIVE_MODE'), liveMode)) {
    throw new WebhookEnvironmentError('unexpected_environment');
  }
}

function safeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

async function findCheckout(
  admin: SupabaseClient,
  externalReference: unknown,
  providerSubscriptionId?: string
): Promise<CheckoutRow | null> {
  const checkoutId = checkoutIdFromReference(externalReference);
  if (checkoutId) {
    const { data, error } = await admin
      .from('payment_checkout_sessions')
      .select('id, provider_subscription_id')
      .eq('id', checkoutId)
      .eq('provider', 'mercado_pago')
      .maybeSingle<CheckoutRow>();
    if (error) throw error;
    if (
      data &&
      (!providerSubscriptionId ||
        checkoutMatchesProviderSubscription(data.provider_subscription_id, providerSubscriptionId))
    ) {
      return data;
    }
    return null; // An explicit conflicting checkout reference must not fall back to another owner.
  }
  if (!providerSubscriptionId) return null;
  const { data, error } = await admin
    .from('payment_checkout_sessions')
    .select('id, provider_subscription_id')
    .eq('provider', 'mercado_pago')
    .eq('provider_subscription_id', providerSubscriptionId)
    .maybeSingle<CheckoutRow>();
  if (error) throw error;
  return data;
}

async function applyPayment({
  admin,
  checkout,
  providerSubscriptionId,
  providerPaymentId,
  providerStatus,
  transactionAmount,
  currency,
  paidAt,
  providerObservedAt,
}: {
  admin: SupabaseClient;
  checkout: CheckoutRow;
  providerSubscriptionId: string;
  providerPaymentId: string;
  providerStatus: string;
  transactionAmount: unknown;
  currency: unknown;
  paidAt: string | null;
  providerObservedAt: string | null;
}) {
  const amountCents = amountInCents(transactionAmount);
  if (
    amountCents === null ||
    typeof currency !== 'string' ||
    !/^[A-Z]{3}$/.test(currency) ||
    !providerStatus ||
    providerStatus.length > 80
  ) {
    throw new Error('Invalid provider payment resource');
  }
  const { error } = await admin.rpc('apply_mercado_pago_payment', {
    p_checkout_session_id: checkout.id,
    p_provider_payment_id: providerPaymentId,
    p_provider_subscription_id: providerSubscriptionId,
    p_provider_status: providerStatus,
    p_amount_cents: amountCents,
    p_currency: currency,
    p_paid_at: paidAt,
    p_provider_observed_at: providerObservedAt,
  });
  if (error) throw error;
}

async function processPreapproval(
  admin: SupabaseClient,
  resourceId: string,
  context: ProviderContext
): Promise<boolean> {
  const subscription = await mercadoPagoRequest<MercadoPagoPreapproval>(
    `/preapproval/${encodeURIComponent(resourceId)}`
  );
  if (subscription.id !== resourceId || typeof subscription.status !== 'string') {
    throw new Error('Invalid provider subscription resource');
  }
  verifyProviderResource(subscription, context);
  const checkout = await findCheckout(admin, subscription.external_reference, resourceId);
  if (!checkout) return false;

  const { data: expectedCheckout, error: expectedCheckoutError } = await admin
    .from('payment_checkout_sessions')
    .select('amount_cents, currency')
    .eq('id', checkout.id)
    .single();
  if (expectedCheckoutError) throw expectedCheckoutError;
  if (
    amountInCents(subscription.auto_recurring?.transaction_amount) !==
      expectedCheckout.amount_cents ||
    subscription.auto_recurring?.currency_id !== expectedCheckout.currency
  ) {
    throw new Error('Provider subscription amount mismatch');
  }

  if (!checkout.provider_subscription_id) {
    const { data: boundCheckout, error: correlationError } = await admin
      .from('payment_checkout_sessions')
      .update({ provider_subscription_id: resourceId })
      .eq('id', checkout.id)
      .is('provider_subscription_id', null)
      .select('id')
      .maybeSingle();
    if (correlationError || !boundCheckout) throw new Error('Subscription correlation changed');
  }
  const { error: syncError } = await admin.rpc('sync_mercado_pago_subscription', {
    p_provider_subscription_id: resourceId,
    p_provider_status: subscription.status,
    p_provider_observed_at: safeTimestamp(subscription.last_modified),
  });
  if (syncError) throw syncError;
  return true;
}

async function processAuthorizedPayment(
  admin: SupabaseClient,
  resourceId: string,
  context: ProviderContext
): Promise<boolean> {
  const invoice = await mercadoPagoRequest<MercadoPagoAuthorizedPayment>(
    `/authorized_payments/${encodeURIComponent(resourceId)}`
  );
  const providerSubscriptionId =
    typeof invoice.preapproval_id === 'string' ? invoice.preapproval_id : null;
  const providerPaymentId =
    typeof invoice.payment?.id === 'number' || typeof invoice.payment?.id === 'string'
      ? String(invoice.payment.id)
      : null;
  const providerStatus =
    typeof invoice.payment?.status === 'string' ? invoice.payment.status : null;
  if (String(invoice.id) !== resourceId || !providerSubscriptionId || !providerPaymentId || !providerStatus) {
    throw new Error('Invalid authorized payment resource');
  }
  const checkout = await findCheckout(
    admin,
    invoice.external_reference,
    providerSubscriptionId
  );
  if (!checkout) return false;
  const payment = await mercadoPagoRequest<MercadoPagoPayment>(`/v1/payments/${encodeURIComponent(providerPaymentId)}`);
  if (String(payment.id) !== providerPaymentId
    || checkoutIdFromReference(payment.external_reference) !== checkout.id
    || amountInCents(payment.transaction_amount) !== amountInCents(invoice.transaction_amount)
    || payment.currency_id !== invoice.currency_id || typeof payment.status !== 'string') {
    throw new Error('Authorized payment correlation failed');
  }
  verifyProviderResource(payment, { ...context, liveMode: undefined });
  await applyPayment({
    admin,
    checkout,
    providerSubscriptionId,
    providerPaymentId,
    providerStatus: payment.status,
    transactionAmount: invoice.transaction_amount,
    currency: invoice.currency_id,
    paidAt: safeTimestamp(payment.date_approved) ?? safeTimestamp(invoice.debit_date),
    providerObservedAt:
      safeTimestamp(payment.date_last_updated) ?? safeTimestamp(invoice.last_modified),
  });
  return true;
}

async function processPayment(
  admin: SupabaseClient,
  resourceId: string,
  context: ProviderContext
): Promise<boolean> {
  const payment = await mercadoPagoRequest<MercadoPagoPayment>(
    `/v1/payments/${encodeURIComponent(resourceId)}`
  );
  const providerPaymentId =
    typeof payment.id === 'number' || typeof payment.id === 'string'
      ? String(payment.id)
      : null;
  const providerStatus = typeof payment.status === 'string' ? payment.status : null;
  if (providerPaymentId !== resourceId || !providerStatus) throw new Error('Invalid provider payment resource');
  verifyProviderResource(payment, { ...context, liveMode: undefined });
  const checkout = await findCheckout(admin, payment.external_reference);
  if (!providerPaymentId || !providerStatus || !checkout?.provider_subscription_id) {
    return false;
  }
  await applyPayment({
    admin,
    checkout,
    providerSubscriptionId: checkout.provider_subscription_id,
    providerPaymentId,
    providerStatus,
    transactionAmount: payment.transaction_amount,
    currency: payment.currency_id,
    paidAt: safeTimestamp(payment.date_approved) ?? safeTimestamp(payment.date_created),
    providerObservedAt:
      safeTimestamp(payment.date_last_updated) ??
      safeTimestamp(payment.date_approved) ??
      safeTimestamp(payment.date_created),
  });
  return true;
}

async function processChargeback(
  admin: SupabaseClient,
  resourceId: string,
  context: ProviderContext
): Promise<boolean> {
  const chargeback = await mercadoPagoRequest<MercadoPagoChargeback>(
    `/v1/chargebacks/${encodeURIComponent(resourceId)}`
  );
  const providerChargebackId =
    typeof chargeback.id === 'number' || typeof chargeback.id === 'string'
      ? String(chargeback.id)
      : null;
  if (providerChargebackId !== resourceId || !Array.isArray(chargeback.payments)) {
    throw new Error('Invalid provider chargeback resource');
  }

  const paymentIds = chargeback.payments
    .filter((paymentId): paymentId is string | number =>
      typeof paymentId === 'string' || typeof paymentId === 'number'
    )
    .map(String);
  if (paymentIds.length === 0 || paymentIds.length !== chargeback.payments.length) {
    throw new Error('Invalid provider chargeback payments');
  }

  let correlated = false;
  for (const paymentId of paymentIds) {
    correlated = (await processPayment(admin, paymentId, context)) || correlated;
  }
  return correlated;
}

Deno.serve(async (request) => {
  const requestStartedAt = Date.now();
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: { Allow: 'POST' } }
    );
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const body = parseMercadoPagoWebhookBody(rawBody);
  const resourceId = body ? signedWebhookResourceId(new URL(request.url), body) : null;
  const eventType = body?.type;
  const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET')?.trim();
  if (!body || !resourceId || !eventType) {
    logPaymentFailure({
      operation: 'webhook_process',
      category: !body ? webhookStructureFailure(rawBody) : 'unsigned_or_conflicting_resource',
      startedAt: requestStartedAt,
      eventType,
    });
    return Response.json({ error: 'Invalid webhook' }, { status: 400 });
  }
  if (!webhookSecret) return Response.json({ error: 'Server configuration is incomplete' }, { status: 500 });

  const signatureIsValid = await validateWebhookSignature({
    signature: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId: resourceId,
    secret: webhookSecret,
  });
  if (!signatureIsValid) {
    logPaymentFailure({
      operation: 'webhook_process',
      category: 'invalid_signature',
      startedAt: requestStartedAt,
      eventType,
    });
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (body.live_mode !== undefined && !webhookEnvironmentMatches(Deno.env.get('MERCADO_PAGO_LIVE_MODE'), body.live_mode)) {
    logPaymentFailure({
      operation: 'webhook_process',
      category: 'unexpected_environment',
      startedAt: requestStartedAt,
      eventType,
    });
    return Response.json({ error: 'Unexpected environment' }, { status: 401 });
  }
  if (!isSupportedMercadoPagoEventType(eventType)) {
    return Response.json({ ok: true, ignored: true });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Server configuration is incomplete' }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const providerEventKey = `${eventType}:${body.id ?? request.headers.get('x-request-id') ?? resourceId}`;
  let processingToken: string | null = null;
  try {
    const context = await providerContext(body.live_mode);
    // For missing subscription environment, do not persist a guessed value.
    // Resource validation below is required before acknowledging the delivery.
    const { data: claim, error: claimError } = await admin.rpc('claim_payment_webhook', {
      p_event_key: providerEventKey, p_event_type: eventType, p_action: body.action ?? null,
      p_resource_id: resourceId, p_live_mode: body.live_mode ?? null,
    }).single<{ outcome: string; token: string | null }>();
    if (claimError || !claim) throw new Error('Unable to claim webhook');
    if (claim.outcome === 'duplicate') return Response.json({ ok: true, outcome: 'duplicate' });
    if (claim.outcome !== 'claimed') return Response.json({ error: 'Webhook in progress', outcome: 'busy' }, { status: 503, headers: { 'Retry-After': '120' } });
    processingToken = claim.token;
    let correlated = false;
    if (eventType === 'subscription_preapproval') {
      correlated = await processPreapproval(admin, resourceId, context);
    } else if (eventType === 'subscription_authorized_payment') {
      correlated = await processAuthorizedPayment(admin, resourceId, context);
    } else if (eventType === 'payment') {
      correlated = await processPayment(admin, resourceId, context);
    } else if (eventType === 'topic_chargebacks_wh') {
      correlated = await processChargeback(admin, resourceId, context);
    }

    const outcome = webhookProcessingOutcome(correlated);
    const { data: finished, error: processedError } = await admin.rpc('finish_payment_webhook', {
      p_event_key: providerEventKey, p_token: processingToken,
      p_processed: outcome.processed, p_error_code: outcome.errorCode,
    });
    if (processedError || !finished) throw new Error('Unable to finish webhook');
    return Response.json({ ok: correlated, outcome: correlated ? 'processed' : 'not_correlated' },
      { status: correlated ? 200 : 503 });
  } catch (error) {
    logPaymentFailure({
      operation: 'webhook_process',
      category: error instanceof WebhookEnvironmentError ? error.message : 'processing_failed',
      startedAt: requestStartedAt,
      eventType,
    });
    if (processingToken) await admin.rpc('finish_payment_webhook', {
      p_event_key: providerEventKey, p_token: processingToken,
      p_processed: false, p_error_code: 'processing_failed',
    });
    return Response.json({ error: 'Webhook processing failed' }, { status: error instanceof WebhookEnvironmentError ? 401 : 500 });
  }
});
