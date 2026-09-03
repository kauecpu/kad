-- Keep financial status and its user-facing reason in the same locked transaction.
-- No rows, prices, permissions or API signatures are removed or changed.

create or replace function private.apply_mercado_pago_payment(
  p_checkout_session_id uuid,
  p_provider_payment_id text,
  p_provider_subscription_id text,
  p_provider_status text,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz default null,
  p_provider_observed_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout public.payment_checkout_sessions%rowtype;
  previous_transaction public.payment_transactions%rowtype;
  should_extend boolean := false;
  period_start timestamptz;
  period_end timestamptz;
  existing_period_end timestamptz;
  incoming_is_terminal boolean := p_provider_status in ('refunded', 'charged_back');
begin
  if nullif(btrim(p_provider_payment_id), '') is null
     or char_length(p_provider_payment_id) > 160
     or nullif(btrim(p_provider_subscription_id), '') is null
     or char_length(p_provider_subscription_id) > 160
     or nullif(btrim(p_provider_status), '') is null
     or char_length(p_provider_status) > 80
     or p_amount_cents is null
     or p_amount_cents < 0
     or p_currency is null
     or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'Invalid provider payment data';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('mercado_pago_payment:' || p_provider_payment_id, 0)
  );

  select *
  into checkout
  from public.payment_checkout_sessions
  where id = p_checkout_session_id
  for update;

  if not found then
    raise exception 'Unknown checkout session';
  end if;
  if checkout.provider <> 'mercado_pago' then
    raise exception 'Unexpected payment provider';
  end if;
  if checkout.provider_subscription_id is not null
     and checkout.provider_subscription_id <> p_provider_subscription_id then
    raise exception 'Subscription correlation failed';
  end if;
  if checkout.amount_cents <> p_amount_cents or checkout.currency <> p_currency then
    raise exception 'Payment amount does not match checkout';
  end if;

  select *
  into previous_transaction
  from public.payment_transactions
  where provider_payment_id = p_provider_payment_id
  for update;

  if found then
    if previous_transaction.checkout_session_id is distinct from checkout.id
       or previous_transaction.user_id is distinct from checkout.user_id
       or previous_transaction.provider_subscription_id <> p_provider_subscription_id
       or previous_transaction.amount_cents <> p_amount_cents
       or previous_transaction.currency <> p_currency then
      raise exception 'Payment correlation failed';
    end if;

    if not incoming_is_terminal
       and p_provider_observed_at is not null
       and previous_transaction.provider_observed_at is not null
       and p_provider_observed_at < previous_transaction.provider_observed_at then
      return;
    end if;

    if previous_transaction.terminal_status is not null
       and not incoming_is_terminal then
      return;
    end if;

    should_extend := p_provider_status = 'approved'
      and previous_transaction.credit_applied_at is null
      and previous_transaction.terminal_status is null;

    update public.payment_transactions
    set
      provider_status = p_provider_status,
      paid_at = case
        when p_provider_status = 'approved' and p_paid_at is not null then p_paid_at
        else coalesce(paid_at, p_paid_at)
      end,
      provider_observed_at = case
        when p_provider_observed_at is null then provider_observed_at
        when provider_observed_at is null
          or p_provider_observed_at >= provider_observed_at
          then p_provider_observed_at
        else provider_observed_at
      end,
      credit_applied_at = case
        when should_extend
          then coalesce(p_provider_observed_at, p_paid_at, timezone('utc', now()))
        else credit_applied_at
      end,
      terminal_status = case
        when terminal_status is null and incoming_is_terminal then p_provider_status
        else terminal_status
      end,
      terminal_observed_at = case
        when terminal_status is null and incoming_is_terminal
          then coalesce(p_provider_observed_at, timezone('utc', now()))
        else terminal_observed_at
      end
    where provider_payment_id = p_provider_payment_id;
  else
    should_extend := p_provider_status = 'approved';
    insert into public.payment_transactions (
      provider_payment_id,
      checkout_session_id,
      user_id,
      provider_subscription_id,
      provider_status,
      amount_cents,
      currency,
      paid_at,
      credit_applied_at,
      provider_observed_at,
      terminal_status,
      terminal_observed_at
    ) values (
      p_provider_payment_id,
      checkout.id,
      checkout.user_id,
      p_provider_subscription_id,
      p_provider_status,
      p_amount_cents,
      p_currency,
      p_paid_at,
      case
        when should_extend
          then coalesce(p_provider_observed_at, p_paid_at, timezone('utc', now()))
        else null
      end,
      p_provider_observed_at,
      case when incoming_is_terminal then p_provider_status else null end,
      case
        when incoming_is_terminal
          then coalesce(p_provider_observed_at, timezone('utc', now()))
        else null
      end
    );
  end if;

  update public.payment_checkout_sessions
  set provider_subscription_id = coalesce(provider_subscription_id, p_provider_subscription_id)
  where id = checkout.id;

  if p_provider_status = 'approved' then
    update public.payment_checkout_sessions
    set status = 'approved', status_reason = null
    where id = checkout.id;

    if should_extend then
      select current_period_end
      into existing_period_end
      from public.subscriptions
      where user_id = checkout.user_id
      for update;

      period_start := greatest(
        coalesce(p_paid_at, timezone('utc', now())),
        coalesce(existing_period_end, coalesce(p_paid_at, timezone('utc', now())))
      );
      period_end := private.payment_period_end(period_start, checkout.billing_cycle);

      insert into public.subscriptions (
        user_id,
        plan,
        billing_cycle,
        provider,
        provider_subscription_id,
        provider_status,
        status,
        started_at,
        current_period_end,
        cancel_at_period_end,
        last_payment_id,
        last_payment_at
      ) values (
        checkout.user_id,
        checkout.plan,
        checkout.billing_cycle,
        'mercado_pago',
        p_provider_subscription_id,
        'authorized',
        'active',
        coalesce(p_paid_at, timezone('utc', now())),
        period_end,
        false,
        p_provider_payment_id,
        coalesce(p_paid_at, timezone('utc', now()))
      )
      on conflict (user_id) do update
      set
        plan = excluded.plan,
        billing_cycle = excluded.billing_cycle,
        provider = excluded.provider,
        provider_subscription_id = excluded.provider_subscription_id,
        provider_status = excluded.provider_status,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = false,
        last_payment_id = excluded.last_payment_id,
        last_payment_at = excluded.last_payment_at;
    end if;
  elsif incoming_is_terminal then
    update public.payment_checkout_sessions
    set status = 'canceled',
        status_reason = case coalesce(previous_transaction.terminal_status, p_provider_status)
          when 'refunded' then 'payment_refunded'
          when 'charged_back' then 'payment_chargeback'
        end
    where id = checkout.id;

    update public.subscriptions
    set
      provider_status = p_provider_status,
      status = 'expired',
      current_period_end = least(current_period_end, timezone('utc', now())),
      cancel_at_period_end = true
    where user_id = checkout.user_id
      and provider_subscription_id = p_provider_subscription_id
      and last_payment_id = p_provider_payment_id;
  elsif p_provider_status in ('rejected', 'cancelled', 'canceled') then
    update public.payment_checkout_sessions
    set status_reason = case
          when status = 'approved' then null
          when p_provider_status = 'rejected' then 'payment_rejected'
          else 'subscription_canceled'
        end,
        status = case when status = 'approved' then status else 'failed' end
    where id = checkout.id;

    update public.subscriptions
    set
      provider_status = p_provider_status,
      status = case
        when current_period_end > timezone('utc', now()) then 'past_due'
        else 'expired'
      end
    where user_id = checkout.user_id
      and provider_subscription_id = p_provider_subscription_id;
  end if;
end;
$$;
revoke all on function private.apply_mercado_pago_payment(
  uuid, text, text, text, integer, text, timestamptz, timestamptz
) from public;

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
