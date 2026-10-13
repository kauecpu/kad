-- Expand-only replacement: same RPC signature/grants, no deletion/backfill.
-- Apply before the new validator; legacy past_due + entitled=true fails closed.
create or replace function private.apply_google_play_purchase(
  p_user_id uuid, p_purchase_token text, p_product_id text, p_order_id text,
  p_provider_status text, p_expires_at timestamptz, p_auto_renew boolean, p_entitled boolean
)
returns table (entitled boolean, subscription_status text, current_period_end timestamptz, auto_renew boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_purchase public.google_play_purchases%rowtype;
  candidate public.google_play_purchases%rowtype;
  validated_entitled boolean;
  validated_renew boolean;
  next_status text;
begin
  if p_user_id is null or nullif(btrim(p_purchase_token), '') is null
    or char_length(p_purchase_token) > 4096
    or p_product_id is null or p_product_id not in (
      'kad_platinum_monthly', 'kad_platinum_quarterly', 'kad_platinum_annual',
      'kad_diamond_monthly', 'kad_diamond_quarterly', 'kad_diamond_annual')
    or p_provider_status is null or p_provider_status not in ('active', 'past_due', 'canceled', 'expired')
    or p_entitled is null or p_auto_renew is null then
    raise exception 'Invalid Google Play purchase data';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('google_play_purchase:' || p_purchase_token, 0));
  perform pg_advisory_xact_lock(hashtextextended('google_play_user:' || p_user_id::text, 0));
  select * into existing_purchase from public.google_play_purchases
    where purchase_token = p_purchase_token for update;
  if found and (existing_purchase.user_id <> p_user_id or existing_purchase.product_id <> p_product_id) then
    raise exception 'Google Play purchase belongs to another account';
  end if;
  if exists(select 1 from public.subscriptions
    where provider_subscription_id = p_purchase_token and user_id <> p_user_id) then
    raise exception 'Google Play purchase is already linked to another account';
  end if;

  validated_entitled := p_entitled and p_provider_status in ('active', 'canceled')
    and coalesce(isfinite(p_expires_at) and p_expires_at > now(), false);
  validated_renew := validated_entitled and p_provider_status = 'active' and p_auto_renew;
  next_status := case when validated_entitled then p_provider_status else 'expired' end;
  insert into public.google_play_purchases (
    purchase_token, user_id, product_id, order_id, provider_status, expires_at, auto_renew, entitled
  ) values (
    p_purchase_token, p_user_id, p_product_id, p_order_id, p_provider_status,
    p_expires_at, validated_renew, validated_entitled
  ) on conflict (purchase_token) do update set
    order_id = excluded.order_id, provider_status = excluded.provider_status,
    expires_at = excluded.expires_at, auto_renew = excluded.auto_renew, entitled = excluded.entitled;

  select * into candidate from public.google_play_purchases where purchase_token = p_purchase_token;
  if not validated_entitled then
    -- Revoke this purchase only. A different previously verified eligible purchase
    -- may still grant access; prefer Diamond, then the longest remaining period.
    select * into candidate from public.google_play_purchases gp
      where gp.user_id = p_user_id and gp.entitled and gp.provider_status in ('active', 'canceled')
        and isfinite(gp.expires_at) and gp.expires_at > now()
      order by (gp.product_id like 'kad_diamond_%') desc, gp.expires_at desc, gp.purchase_token
      limit 1;
    if not found then
      select * into candidate from public.google_play_purchases where purchase_token = p_purchase_token;
    end if;
  end if;

  insert into public.subscriptions as current_subscription (
    user_id, plan, billing_cycle, provider, provider_subscription_id, provider_status, status,
    started_at, current_period_end, cancel_at_period_end, last_payment_id, last_payment_at
  ) values (
    p_user_id, case when candidate.product_id like 'kad_platinum_%' then 'platinum' else 'diamond' end,
    split_part(candidate.product_id, '_', 3), 'google', candidate.purchase_token, candidate.provider_status,
    case when candidate.entitled then candidate.provider_status else 'expired' end,
    now(), coalesce(candidate.expires_at, now()), not candidate.auto_renew, candidate.order_id, now()
  ) on conflict (user_id) do update set
    plan = excluded.plan, billing_cycle = excluded.billing_cycle, provider = excluded.provider,
    provider_subscription_id = excluded.provider_subscription_id, provider_status = excluded.provider_status,
    status = excluded.status, current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end, last_payment_id = excluded.last_payment_id,
    last_payment_at = excluded.last_payment_at
  -- Evaluate under the upsert row lock, including concurrent non-Google writers.
  -- A negative result cannot overwrite another currently valid subscription.
  where validated_entitled
    or (current_subscription.provider = 'google' and current_subscription.provider_subscription_id = p_purchase_token)
    or current_subscription.status = 'expired' or current_subscription.current_period_end <= now();

  -- Response describes this validated purchase, not unrelated entitlement.
  return query select validated_entitled, next_status, p_expires_at, validated_renew;
end;
$$;

revoke all on function private.apply_google_play_purchase(uuid, text, text, text, text, timestamptz, boolean, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_google_play_purchase(uuid, text, text, text, text, timestamptz, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_google_play_purchase(uuid, text, text, text, text, timestamptz, boolean, boolean)
  to service_role;
