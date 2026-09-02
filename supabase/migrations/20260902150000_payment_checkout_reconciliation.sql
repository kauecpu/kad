alter table public.payment_checkout_sessions
add column if not exists last_reconciliation_at timestamptz;

create or replace function public.claim_payment_checkout_reconciliation(
  p_checkout_id uuid,
  p_user_id uuid
)
returns table (
  claimed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout public.payment_checkout_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
  v_retry_after integer;
begin
  if p_checkout_id is null or p_user_id is null then
    raise exception 'Checkout and user are required';
  end if;

  select session.*
  into checkout
  from public.payment_checkout_sessions as session
  where session.id = p_checkout_id
    and session.user_id = p_user_id
    and session.provider = 'mercado_pago'
  for update;

  if not found or checkout.status not in ('creating', 'pending') then
    return query select false, 0;
    return;
  end if;

  if checkout.last_reconciliation_at is not null
     and checkout.last_reconciliation_at > v_now - interval '10 seconds' then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (
        checkout.last_reconciliation_at + interval '10 seconds' - v_now
      )))::integer
    );
    return query select false, v_retry_after;
    return;
  end if;

  update public.payment_checkout_sessions
  set last_reconciliation_at = v_now
  where id = checkout.id;

  return query select true, 0;
end;
$$;

revoke all on function public.claim_payment_checkout_reconciliation(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.claim_payment_checkout_reconciliation(uuid, uuid)
to service_role;

-- Uma mudança na renovação não pode reclassificar uma cobrança já aprovada. Estorno
-- e chargeback continuam sendo aplicados exclusivamente pela RPC de pagamentos.
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
  update public.payment_checkout_sessions
  set status = case
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
