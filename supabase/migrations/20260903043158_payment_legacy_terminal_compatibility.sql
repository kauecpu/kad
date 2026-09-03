-- Restore only unambiguous legacy reasons from correlated immutable payment evidence.
-- No price, period, transaction, event, subscription or client grant is changed.
create or replace function private.legacy_mercado_pago_checkout_reason(p_checkout_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when count(distinct t.terminal_status) = 1
      and count(*) filter (where t.credit_applied_at is not null and t.terminal_status is null) = 0
    then case min(t.terminal_status)
      when 'refunded' then 'payment_refunded'
      when 'charged_back' then 'payment_chargeback'
    end
  end
  from public.payment_checkout_sessions c
  join public.payment_transactions t
    on t.checkout_session_id = c.id
    and t.user_id = c.user_id
    and t.provider_subscription_id = c.provider_subscription_id
  where c.id = p_checkout_id and c.provider = 'mercado_pago'
    and c.status in ('canceled', 'pending', 'failed', 'expired')
    and c.status_reason is null;
$$;
revoke all on function private.legacy_mercado_pago_checkout_reason(uuid)
from public, anon, authenticated, service_role;

-- Conservative compatibility backfill. Mixed terminal reasons and later valid
-- credits are deliberately left untouched: never infer a reason from UI status.
update public.payment_checkout_sessions c
set status = 'canceled', status_reason = private.legacy_mercado_pago_checkout_reason(c.id)
where c.provider = 'mercado_pago' and c.status_reason is null
  and private.legacy_mercado_pago_checkout_reason(c.id) is not null;

create or replace function private.sync_mercado_pago_subscription(
  p_provider_subscription_id text,
  p_provider_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Same lock order as payment application: checkout before subscription.
  perform 1 from public.payment_checkout_sessions
  where provider = 'mercado_pago' and provider_subscription_id = p_provider_subscription_id
  for update;

  update public.payment_checkout_sessions c
  set status = 'canceled', status_reason = private.legacy_mercado_pago_checkout_reason(c.id)
  where c.provider = 'mercado_pago' and c.provider_subscription_id = p_provider_subscription_id
    and c.status_reason is null
    and private.legacy_mercado_pago_checkout_reason(c.id) is not null;
  update public.payment_checkout_sessions
  set status_reason = case
    when status_reason in ('payment_refunded', 'payment_chargeback') then status_reason
    when payment_checkout_sessions.status = 'approved' then null
    when p_provider_status in ('cancelled', 'canceled') then 'subscription_canceled'
    else status_reason
  end,
  status = case
    when status_reason in ('payment_refunded', 'payment_chargeback') then payment_checkout_sessions.status
    when payment_checkout_sessions.status = 'approved' then 'approved'
    when p_provider_status = 'pending' then 'pending'
    when p_provider_status in ('authorized', 'paused') then payment_checkout_sessions.status
    when p_provider_status in ('cancelled', 'canceled') then 'canceled'
    else payment_checkout_sessions.status
  end
  where provider = 'mercado_pago'
    and provider_subscription_id = p_provider_subscription_id;

  update public.subscriptions
  set
    provider_status = p_provider_status,
    status = case
      when p_provider_status in ('cancelled', 'canceled')
        and current_period_end > timezone('utc', now()) then 'canceled'
      when p_provider_status in ('cancelled', 'canceled') then 'expired'
      when p_provider_status = 'paused'
        and current_period_end > timezone('utc', now()) then 'past_due'
      when p_provider_status = 'paused' then 'expired'
      when p_provider_status = 'authorized'
        and current_period_end > timezone('utc', now()) then 'active'
      when p_provider_status = 'authorized' then 'expired'
      else status
    end,
    cancel_at_period_end = case
      when p_provider_status in ('cancelled', 'canceled') then true
      else cancel_at_period_end
    end
  where provider = 'mercado_pago'
    and provider_subscription_id = p_provider_subscription_id;
end;
$$;

revoke all on function private.sync_mercado_pago_subscription(text, text)
from public;
