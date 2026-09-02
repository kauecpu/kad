import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  checkoutReference,
  isMercadoPagoTestPayerEmail,
  MercadoPagoApiError,
  mercadoPagoRequest,
  paymentPlan,
  paymentReturnUrl,
  paymentWebhookUrl,
} from '../_shared/mercado-pago.ts';
import {
  classifyCheckoutFailure,
  decideCheckoutAction,
  isTrustedCheckoutUrl,
  type OpenCheckout,
} from '../_shared/payment-checkout.ts';
import {
  corsHeaders,
  jsonResponse,
  rejectDisallowedOrigin,
} from '../_shared/http.ts';

type CheckoutLease = {
  lease_token: string | null;
  retry_after_seconds: number;
};

type CheckoutAttempt = {
  allowed: boolean;
  retry_after_seconds: number;
};

type MercadoPagoSubscription = {
  id?: unknown;
  init_point?: unknown;
  status?: unknown;
};

function requiredSupabaseConfiguration() {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return url && anonKey && serviceRoleKey
    ? { url, anonKey, serviceRoleKey }
    : null;
}

function mercadoPagoPayerEmail(userEmail: string) {
  const liveMode = Deno.env.get('MERCADO_PAGO_LIVE_MODE')?.trim();
  if (liveMode === 'true') return userEmail;
  if (liveMode !== 'false') {
    throw new Error('MERCADO_PAGO_LIVE_MODE must be explicitly configured');
  }

  const testPayerEmail = Deno.env.get('MERCADO_PAGO_TEST_PAYER_EMAIL')?.trim();
  if (!isMercadoPagoTestPayerEmail(testPayerEmail)) {
    throw new Error('MERCADO_PAGO_TEST_PAYER_EMAIL is invalid');
  }
  return testPayerEmail;
}

async function cancelPendingProviderSubscription(providerSubscriptionId: string) {
  await mercadoPagoRequest(`/preapproval/${encodeURIComponent(providerSubscriptionId)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'canceled' }),
  });
}

function rateLimitedResponse(origin: string | null, retryAfter: unknown) {
  const seconds = Math.max(1, Math.ceil(Number(retryAfter) || 1));
  return Response.json(
    { error: 'Too many checkout attempts', code: 'checkout_rate_limited' },
    {
      status: 429,
      headers: { ...corsHeaders(origin), 'Retry-After': String(seconds) },
    }
  );
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const rejectedOrigin = rejectDisallowedOrigin(request);
  if (rejectedOrigin) return rejectedOrigin;
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  const configuration = requiredSupabaseConfiguration();
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

  const userClient = createClient(configuration.url, configuration.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user?.email) {
    return jsonResponse({ error: 'Unauthorized', code: 'unauthorized' }, 401, origin);
  }

  const body = await request.json().catch(() => null) as
    | { plan?: unknown; billingCycle?: unknown }
    | null;
  const selectedPlan = paymentPlan(body?.plan, body?.billingCycle);
  if (!selectedPlan) {
    return jsonResponse(
      { error: 'Unsupported plan', code: 'unsupported_plan' },
      400,
      origin
    );
  }

  let payerEmail: string;
  try {
    payerEmail = mercadoPagoPayerEmail(user.email);
  } catch {
    return jsonResponse(
      { error: 'Server configuration is incomplete', code: 'server_not_configured' },
      500,
      origin
    );
  }

  const admin = createClient(configuration.url, configuration.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let leaseToken: string | null = null;

  try {
    const { data: lease, error: leaseError } = await admin
      .rpc('acquire_payment_checkout_lease', { p_user_id: user.id })
      .single<CheckoutLease>();
    if (leaseError) throw leaseError;
    if (!lease?.lease_token) {
      return rateLimitedResponse(origin, lease?.retry_after_seconds);
    }
    leaseToken = lease.lease_token;

    const { data: subscription, error: subscriptionError } = await admin
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (
      subscription &&
      new Date(subscription.current_period_end).getTime() > Date.now() &&
      ['active', 'past_due', 'canceled'].includes(subscription.status)
    ) {
      return jsonResponse(
        { error: 'Subscription already has access', code: 'subscription_active' },
        409,
        origin
      );
    }

    const { data: openCheckout, error: openCheckoutError } = await admin
      .from('payment_checkout_sessions')
      .select(
        'id, plan, billing_cycle, provider_subscription_id, checkout_url, status, created_at, expires_at'
      )
      .eq('user_id', user.id)
      .in('status', ['creating', 'pending'])
      .maybeSingle<OpenCheckout>();
    if (openCheckoutError) throw openCheckoutError;

    const checkoutAction = decideCheckoutAction(openCheckout, selectedPlan);
    if (checkoutAction === 'reuse' && openCheckout?.checkout_url) {
      return jsonResponse(
        { checkoutUrl: openCheckout.checkout_url, checkoutId: openCheckout.id, reused: true },
        200,
        origin
      );
    }

    if (checkoutAction === 'in_progress') {
      return jsonResponse(
        { error: 'Checkout creation is already in progress', code: 'checkout_in_progress' },
        409,
        origin
      );
    }

    const { data: attempt, error: attemptError } = await admin
      .rpc('consume_payment_checkout_attempt', {
        p_user_id: user.id,
        p_lease_token: leaseToken,
      })
      .single<CheckoutAttempt>();
    if (attemptError) throw attemptError;
    if (!attempt?.allowed) {
      return rateLimitedResponse(origin, attempt?.retry_after_seconds);
    }

    if (openCheckout) {
      if (openCheckout.provider_subscription_id) {
        await cancelPendingProviderSubscription(openCheckout.provider_subscription_id);
      }
      const { error: closeError } = await admin
        .from('payment_checkout_sessions')
        .update({
          status:
            openCheckout.status === 'creating'
              ? 'failed'
              : new Date(openCheckout.expires_at).getTime() <= Date.now()
                ? 'expired'
                : 'canceled',
          status_reason: 'checkout_replaced',
        })
        .eq('id', openCheckout.id);
      if (closeError) throw closeError;
    }

    const { data: checkout, error: checkoutError } = await admin
      .from('payment_checkout_sessions')
      .insert({
        user_id: user.id,
        plan: selectedPlan.plan,
        billing_cycle: selectedPlan.billingCycle,
        provider: 'mercado_pago',
        amount_cents: selectedPlan.amountCents,
        currency: 'BRL',
        status: 'creating',
      })
      .select('id')
      .single();
    if (checkoutError) throw checkoutError;

    try {
      const providerSubscription = await mercadoPagoRequest<MercadoPagoSubscription>(
        '/preapproval',
        {
          method: 'POST',
          headers: { 'X-Idempotency-Key': checkout.id },
          body: JSON.stringify({
            reason: selectedPlan.title,
            external_reference: checkoutReference(checkout.id),
            payer_email: payerEmail,
            auto_recurring: {
              frequency: selectedPlan.frequency,
              frequency_type: selectedPlan.frequencyType,
              transaction_amount: selectedPlan.amountCents / 100,
              currency_id: 'BRL',
            },
            back_url: paymentReturnUrl(checkout.id),
            notification_url: paymentWebhookUrl(),
            status: 'pending',
          }),
        }
      );
      if (
        typeof providerSubscription.id !== 'string' ||
        !isTrustedCheckoutUrl(providerSubscription.init_point)
      ) {
        throw new Error('Provider returned an invalid checkout');
      }

      const { error: updateError } = await admin
        .from('payment_checkout_sessions')
        .update({
          provider_subscription_id: providerSubscription.id,
          checkout_url: providerSubscription.init_point,
          status: 'pending',
          status_reason: null,
        })
        .eq('id', checkout.id);
      if (updateError) throw updateError;

      return jsonResponse(
        {
          checkoutUrl: providerSubscription.init_point,
          checkoutId: checkout.id,
          reused: false,
        },
        200,
        origin
      );
    } catch (error) {
      const statusReason = classifyCheckoutFailure(error);
      await admin
        .from('payment_checkout_sessions')
        .update({ status: 'failed', status_reason: statusReason })
        .eq('id', checkout.id);
      throw error;
    }
  } catch (error) {
    const statusReason = classifyCheckoutFailure(error);
    console.error(
      'create-payment-checkout failed',
      error instanceof MercadoPagoApiError
        ? { message: error.message, providerCode: error.providerCode }
        : error instanceof Error
          ? error.message
          : error
    );
    return jsonResponse(
      {
        error: 'Unable to create checkout',
        code: statusReason === 'configuration_missing'
          ? 'server_not_configured'
          : 'checkout_unavailable',
      },
      statusReason === 'configuration_missing' ? 500 : 502,
      origin
    );
  } finally {
    if (leaseToken) {
      const { error: releaseError } = await admin.rpc('release_payment_checkout_lease', {
        p_user_id: user.id,
        p_lease_token: leaseToken,
      });
      if (releaseError) console.error('create-payment-checkout lease release failed');
    }
  }
});
