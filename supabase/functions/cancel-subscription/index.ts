import { createClient } from 'npm:@supabase/supabase-js@2';

import { mercadoPagoRequest } from '../_shared/mercado-pago.ts';
import {
  corsHeaders,
  jsonResponse,
  rejectDisallowedOrigin,
} from '../_shared/http.ts';

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(
      { error: 'Server configuration is incomplete', code: 'server_not_configured' },
      500,
      origin
    );
  }
  if (!authorization) {
    return jsonResponse({ error: 'Unauthorized', code: 'unauthorized' }, 401, origin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data: subscription, error: subscriptionError } = await admin
      .from('subscriptions')
      .select(
        'provider, provider_subscription_id, cancel_at_period_end, current_period_end'
      )
      .eq('user_id', user.id)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription) {
      return jsonResponse(
        { error: 'Subscription not found', code: 'subscription_not_found' },
        404,
        origin
      );
    }
    if (subscription.cancel_at_period_end) {
      return jsonResponse(
        { ok: true, currentPeriodEnd: subscription.current_period_end },
        200,
        origin
      );
    }
    if (subscription.provider !== 'mercado_pago') {
      return jsonResponse(
        { error: 'Manage this subscription in its app store', code: 'store_managed' },
        409,
        origin
      );
    }

    await mercadoPagoRequest(
      `/preapproval/${encodeURIComponent(subscription.provider_subscription_id)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status: 'canceled' }),
      }
    );
    const { error: syncError } = await admin.rpc('sync_mercado_pago_subscription', {
      p_provider_subscription_id: subscription.provider_subscription_id,
      p_provider_status: 'canceled',
    });
    if (syncError) throw syncError;

    return jsonResponse(
      { ok: true, currentPeriodEnd: subscription.current_period_end },
      200,
      origin
    );
  } catch (error) {
    console.error('cancel-subscription failed', error instanceof Error ? error.message : error);
    return jsonResponse(
      { error: 'Unable to cancel subscription', code: 'cancellation_unavailable' },
      502,
      origin
    );
  }
});
