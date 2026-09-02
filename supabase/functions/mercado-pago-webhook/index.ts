import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  amountInCents,
  checkoutIdFromReference,
  mercadoPagoRequest,
  validateWebhookSignature,
} from '../_shared/mercado-pago.ts';
import {
  checkoutMatchesProviderSubscription,
  type MercadoPagoWebhookBody,
  parseMercadoPagoWebhookBody,
  paymentStatusReason,
  webhookProcessingOutcome,
  webhookEnvironmentMatches,
} from '../_shared/mercado-pago-webhook.ts';

type CheckoutRow = {
  id: string;
  provider_subscription_id: string | null;
};

type MercadoPagoPreapproval = {
  id?: unknown;
  external_reference?: unknown;
  status?: unknown;
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

function resourceIdFrom(request: Request, body: MercadoPagoWebhookBody) {
  const url = new URL(request.url);
  return (
    url.searchParams.get('data.id') ??
    url.searchParams.get('data_id') ??
    (body.data?.id === undefined ? null : String(body.data.id))
  );
}

function queryDataId(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get('data.id') ?? url.searchParams.get('data_id');
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
  let reasonUpdate = admin
    .from('payment_checkout_sessions')
    .update({ status_reason: paymentStatusReason(providerStatus) })
    .eq('id', checkout.id);
  if (providerStatus === 'rejected') reasonUpdate = reasonUpdate.neq('status', 'approved');
  const { error: reasonError } = await reasonUpdate;
  if (reasonError) throw reasonError;
}

async function processPreapproval(
  admin: SupabaseClient,
  resourceId: string
): Promise<boolean> {
  const subscription = await mercadoPagoRequest<MercadoPagoPreapproval>(
    `/preapproval/${encodeURIComponent(resourceId)}`
  );
  if (subscription.id !== resourceId || typeof subscription.status !== 'string') {
    throw new Error('Invalid provider subscription resource');
  }
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
    const { error: correlationError } = await admin
      .from('payment_checkout_sessions')
      .update({ provider_subscription_id: resourceId })
      .eq('id', checkout.id)
      .is('provider_subscription_id', null);
    if (correlationError) throw correlationError;
  }
  const { error: syncError } = await admin.rpc('sync_mercado_pago_subscription', {
    p_provider_subscription_id: resourceId,
    p_provider_status: subscription.status,
  });
  if (syncError) throw syncError;
  const subscriptionReason = ['cancelled', 'canceled'].includes(subscription.status)
    ? 'subscription_canceled'
    : null;
  const { error: reasonError } = await admin
    .from('payment_checkout_sessions')
    .update({ status_reason: subscriptionReason })
    .eq('id', checkout.id);
  if (reasonError) throw reasonError;
  return true;
}

async function processAuthorizedPayment(
  admin: SupabaseClient,
  resourceId: string
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
  if (!providerSubscriptionId || !providerPaymentId || !providerStatus) {
    throw new Error('Invalid authorized payment resource');
  }
  const checkout = await findCheckout(
    admin,
    invoice.external_reference,
    providerSubscriptionId
  );
  if (!checkout) return false;
  await applyPayment({
    admin,
    checkout,
    providerSubscriptionId,
    providerPaymentId,
    providerStatus,
    transactionAmount: invoice.transaction_amount,
    currency: invoice.currency_id,
    paidAt: safeTimestamp(invoice.debit_date),
    providerObservedAt:
      safeTimestamp(invoice.last_modified) ?? safeTimestamp(invoice.date_created),
  });
  return true;
}

async function processPayment(
  admin: SupabaseClient,
  resourceId: string
): Promise<boolean> {
  const payment = await mercadoPagoRequest<MercadoPagoPayment>(
    `/v1/payments/${encodeURIComponent(resourceId)}`
  );
  const providerPaymentId =
    typeof payment.id === 'number' || typeof payment.id === 'string'
      ? String(payment.id)
      : null;
  const providerStatus = typeof payment.status === 'string' ? payment.status : null;
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
  resourceId: string
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
    correlated = (await processPayment(admin, paymentId)) || correlated;
  }
  return correlated;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: { Allow: 'POST' } }
    );
  }

  const body = parseMercadoPagoWebhookBody(await request.json().catch(() => null));
  const resourceId = body ? resourceIdFrom(request, body) : null;
  const eventType = body?.type;
  const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET')?.trim();
  if (!body || !resourceId || !eventType || !webhookSecret) {
    return Response.json({ error: 'Invalid webhook' }, { status: 400 });
  }

  const signatureIsValid = await validateWebhookSignature({
    signature: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId: queryDataId(request),
    secret: webhookSecret,
  });
  if (!signatureIsValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (!webhookEnvironmentMatches(Deno.env.get('MERCADO_PAGO_LIVE_MODE'), body.live_mode)) {
    return Response.json({ error: 'Unexpected environment' }, { status: 401 });
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

  const { data: existingEvent, error: existingEventError } = await admin
    .from('payment_webhook_events')
    .select('processed')
    .eq('provider_event_key', providerEventKey)
    .maybeSingle();
  if (existingEventError) {
    return Response.json({ error: 'Unable to record webhook' }, { status: 500 });
  }
  if (existingEvent?.processed) return Response.json({ ok: true });

  const { error: eventError } = await admin.from('payment_webhook_events').upsert({
    provider_event_key: providerEventKey,
    event_type: eventType,
    action: body.action ?? null,
    resource_id: resourceId,
    live_mode: body.live_mode ?? null,
    processed: false,
    error_code: null,
    processed_at: null,
  });
  if (eventError) {
    return Response.json({ error: 'Unable to record webhook' }, { status: 500 });
  }

  try {
    let correlated = false;
    if (eventType === 'subscription_preapproval') {
      correlated = await processPreapproval(admin, resourceId);
    } else if (eventType === 'subscription_authorized_payment') {
      correlated = await processAuthorizedPayment(admin, resourceId);
    } else if (eventType === 'payment') {
      correlated = await processPayment(admin, resourceId);
    } else if (eventType === 'topic_chargebacks_wh') {
      correlated = await processChargeback(admin, resourceId);
    }

    const outcome = webhookProcessingOutcome(correlated);
    const { error: processedError } = await admin
      .from('payment_webhook_events')
      .update({
        processed: outcome.processed,
        processed_at: outcome.processed ? new Date().toISOString() : null,
        error_code: outcome.errorCode,
      })
      .eq('provider_event_key', providerEventKey);
    if (processedError) throw processedError;
    return Response.json({ ok: true });
  } catch (error) {
    console.error('mercado-pago-webhook failed', error instanceof Error ? error.message : error);
    await admin
      .from('payment_webhook_events')
      .update({ error_code: 'processing_failed' })
      .eq('provider_event_key', providerEventKey);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
});
