import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  MercadoPagoApiError,
  mercadoPagoRequest,
} from '../_shared/mercado-pago.ts';
import {
  authorizedPaymentsSearchPath,
  reconcileAuthorizedPayments,
  reconcileProviderSubscription,
  type PaymentReconciliationTarget,
} from '../_shared/mercado-pago-reconciliation.ts';
import {
  classifyCheckoutFailure,
} from '../_shared/payment-checkout.ts';
import {
  corsHeaders,
  jsonResponse,
  rejectDisallowedOrigin,
} from '../_shared/http.ts';
import { logPaymentFailure } from '../_shared/payment-observability.ts';

type CheckoutRow = {
  id: string;
  user_id: string;
  provider_subscription_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  status_reason: string | null;
};

type ReconciliationClaim = {
  claimed: boolean;
  retry_after_seconds: number;
};

function requiredConfiguration() {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return url && anonKey && serviceRoleKey
    ? { url, anonKey, serviceRoleKey }
    : null;
}

function checkoutIdFromBody(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('checkoutId' in value)) return null;
  const checkoutId = (value as { checkoutId?: unknown }).checkoutId;
  return typeof checkoutId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutId)
    ? checkoutId.toLowerCase()
    : null;
}

function publicCheckout(checkout: CheckoutRow) {
  return {
    status: checkout.status,
    reason: checkout.status_reason,
  };
}

Deno.serve(async (request) => {
  const requestStartedAt = Date.now();
  const origin = request.headers.get('Origin');
  const rejectedOrigin = rejectDisallowedOrigin(request);
  if (rejectedOrigin) return rejectedOrigin;
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  const configuration = requiredConfiguration();
  if (!configuration) {
    return jsonResponse(
      { error: 'Server configuration is incomplete', code: 'server_not_configured' },
      500,
      origin
    );
  }
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return jsonResponse({ error: 'Unauthorized', code: 'unauthorized' }, 401, origin);
  }

  const checkoutId = checkoutIdFromBody(await request.json().catch(() => null));
  if (!checkoutId) {
    return jsonResponse({ error: 'Invalid checkout', code: 'invalid_checkout' }, 400, origin);
  }

  const userClient = createClient(configuration.url, configuration.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized', code: 'unauthorized' }, 401, origin);
  }

  const admin = createClient(configuration.url, configuration.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: checkout, error: checkoutError } = await admin
    .from('payment_checkout_sessions')
    .select('id, user_id, provider_subscription_id, amount_cents, currency, status, status_reason')
    .eq('id', checkoutId)
    .eq('user_id', user.id)
    .eq('provider', 'mercado_pago')
    .maybeSingle<CheckoutRow>();
  if (checkoutError) {
    return jsonResponse({ error: 'Unable to read checkout', code: 'checkout_unavailable' }, 500, origin);
  }
  if (!checkout) {
    return jsonResponse({ error: 'Checkout not found', code: 'checkout_not_found' }, 404, origin);
  }
  if (!['creating', 'pending'].includes(checkout.status)) {
    return jsonResponse(publicCheckout(checkout), 200, origin);
  }
  if (!checkout.provider_subscription_id) {
    return jsonResponse(publicCheckout(checkout), 200, origin);
  }

  const { data: claim, error: claimError } = await admin
    .rpc('claim_payment_checkout_reconciliation', {
      p_checkout_id: checkout.id,
      p_user_id: user.id,
    })
    .single<ReconciliationClaim>();
  if (claimError) {
    return jsonResponse({ error: 'Unable to refresh checkout', code: 'checkout_unavailable' }, 500, origin);
  }
  if (!claim?.claimed) {
    const retryAfter = Math.ceil(Number(claim?.retry_after_seconds) || 0);
    if (retryAfter <= 0) {
      const { data: finished, error: finishedError } = await admin
        .from('payment_checkout_sessions')
        .select('id, user_id, provider_subscription_id, amount_cents, currency, status, status_reason')
        .eq('id', checkout.id)
        .eq('user_id', user.id)
        .single<CheckoutRow>();
      if (finishedError) {
        return jsonResponse({ error: 'Unable to refresh checkout', code: 'checkout_unavailable' }, 500, origin);
      }
      return jsonResponse(publicCheckout(finished), 200, origin);
    }
    const seconds = Math.max(1, retryAfter);
    return Response.json(
      { error: 'Checkout refresh is rate limited', code: 'checkout_refresh_rate_limited' },
      { status: 429, headers: { ...corsHeaders(origin), 'Retry-After': String(seconds) } }
    );
  }

  const target: PaymentReconciliationTarget = {
    checkoutId: checkout.id,
    providerSubscriptionId: checkout.provider_subscription_id,
    amountCents: checkout.amount_cents,
    currency: checkout.currency,
  };

  try {
    const providerSubscription = reconcileProviderSubscription(
      await mercadoPagoRequest(`/preapproval/${encodeURIComponent(target.providerSubscriptionId)}`),
      target
    );
    if (!providerSubscription) throw new Error('Provider returned an invalid checkout');

    const { error: subscriptionError } = await admin.rpc('sync_mercado_pago_subscription', {
      p_provider_subscription_id: target.providerSubscriptionId,
      p_provider_status: providerSubscription.status,
    });
    if (subscriptionError) throw subscriptionError;

    const authorizedPayments = reconcileAuthorizedPayments(
      await mercadoPagoRequest(authorizedPaymentsSearchPath(target.providerSubscriptionId)),
      target
    );
    if (!authorizedPayments) throw new Error('Provider returned an invalid checkout');

    for (const payment of authorizedPayments) {
      const { error: paymentError } = await admin.rpc('apply_mercado_pago_payment', {
        p_checkout_session_id: target.checkoutId,
        p_provider_payment_id: payment.providerPaymentId,
        p_provider_subscription_id: target.providerSubscriptionId,
        p_provider_status: payment.providerStatus,
        p_amount_cents: payment.amountCents,
        p_currency: payment.currency,
        p_paid_at: payment.paidAt,
        p_provider_observed_at: payment.providerObservedAt,
      });
      if (paymentError) throw paymentError;
    }

    const { data: refreshed, error: refreshedError } = await admin
      .from('payment_checkout_sessions')
      .select('id, user_id, provider_subscription_id, amount_cents, currency, status, status_reason')
      .eq('id', target.checkoutId)
      .eq('user_id', user.id)
      .single<CheckoutRow>();
    if (refreshedError) throw refreshedError;
    return jsonResponse(publicCheckout(refreshed), 200, origin);
  } catch (error) {
    const reason = classifyCheckoutFailure(error);
    logPaymentFailure({
      operation: 'checkout_reconcile',
      category: reason,
      startedAt: requestStartedAt,
      checkoutId: target.checkoutId,
      providerStatus: error instanceof MercadoPagoApiError ? error.status : undefined,
      providerCode: error instanceof MercadoPagoApiError ? error.providerCode : undefined,
    });
    await admin
      .from('payment_checkout_sessions')
      .update({ status_reason: reason })
      .eq('id', target.checkoutId)
      .in('status', ['creating', 'pending']);
    return jsonResponse(
      {
        error: 'Unable to refresh checkout',
        code: reason === 'configuration_missing'
          ? 'server_not_configured'
          : 'checkout_refresh_unavailable',
      },
      reason === 'configuration_missing' ? 500 : 502,
      origin
    );
  }
});
