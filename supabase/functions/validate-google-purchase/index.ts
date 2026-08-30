import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  classifyGooglePurchase,
  GOOGLE_PRODUCT_CATALOG,
  type GooglePurchase,
} from '../_shared/google-play.ts';
import { corsHeaders, jsonResponse, rejectDisallowedOrigin } from '../_shared/http.ts';

type ServiceAccount = { client_email?: string; private_key?: string };

function base64Url(value: ArrayBuffer | string) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function accessToken(account: ServiceAccount) {
  if (!account.client_email || !account.private_key) throw new Error('Invalid service account');
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3_600,
  }));
  const pem = account.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${base64Url(signature)}`,
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth failed (${response.status})`);
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error('Google OAuth returned no access token');
  return body.access_token;
}

function bodyError(code: string, status: number, origin: string | null, error: string) {
  return jsonResponse({ error, code }, status, origin);
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const rejectedOrigin = rejectDisallowedOrigin(request);
  if (rejectedOrigin) return rejectedOrigin;
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return bodyError('method_not_allowed', 405, origin, 'Method not allowed');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const packageName = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME');
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !packageName || !serviceAccountJson) {
    return bodyError('server_not_configured', 500, origin, 'Google Play validation is not configured');
  }
  if (!authorization) return bodyError('unauthorized', 401, origin, 'Unauthorized');

  let input: { productId?: unknown; purchaseToken?: unknown };
  try {
    input = await request.json();
  } catch {
    return bodyError('invalid_request', 400, origin, 'Invalid JSON body');
  }
  const productId = typeof input.productId === 'string' ? input.productId : '';
  const purchaseToken = typeof input.purchaseToken === 'string' ? input.purchaseToken : '';
  if (!GOOGLE_PRODUCT_CATALOG[productId] || !purchaseToken || purchaseToken.length > 4096) {
    return bodyError('invalid_request', 400, origin, 'Product and purchase token are required');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return bodyError('unauthorized', 401, origin, 'Unauthorized');

  try {
    const account = JSON.parse(serviceAccountJson) as ServiceAccount;
    const token = await accessToken(account);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 404) return bodyError('invalid_purchase', 422, origin, 'Purchase token not found');
    if (!response.ok) return bodyError('google_unavailable', 502, origin, 'Google Play could not verify the purchase');
    const purchase = await response.json() as GooglePurchase;
    const state = classifyGooglePurchase(purchase, productId);
    if (!state.ok) {
      const status = state.code === 'purchase_pending' ? 409 : 422;
      return bodyError(state.code, status, origin, state.code === 'purchase_pending'
        ? 'Purchase is pending'
        : state.code === 'product_mismatch'
          ? 'Purchase product does not match the request'
          : 'Invalid product');
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc('apply_google_play_purchase', {
      p_user_id: user.id,
      p_purchase_token: purchaseToken,
      p_product_id: productId,
      p_order_id: state.orderId,
      p_provider_status: state.status,
      p_expires_at: state.expiresAt,
      p_auto_renew: state.autoRenew,
      p_entitled: state.entitled,
    });
    if (error) {
      console.error('apply_google_play_purchase failed', error.message);
      return bodyError('purchase_rejected', 422, origin, 'Purchase could not be linked to this account');
    }
    const result = Array.isArray(data) ? data[0] : data;
    return jsonResponse({
      ok: true,
      entitled: Boolean(result?.entitled),
      plan: state.plan,
      billingCycle: state.billingCycle,
      status: result?.subscription_status ?? state.status,
      currentPeriodEnd: result?.current_period_end ?? state.expiresAt ?? undefined,
      autoRenew: Boolean(result?.auto_renew),
    }, 200, origin);
  } catch (error) {
    console.error('validate-google-purchase failed', error instanceof Error ? error.message : error);
    return bodyError('google_unavailable', 502, origin, 'Google Play validation is temporarily unavailable');
  }
});
