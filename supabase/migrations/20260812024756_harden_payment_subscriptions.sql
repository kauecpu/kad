create table if not exists private.payment_checkout_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (lease_token is null and lease_expires_at is null)
    or (lease_token is not null and lease_expires_at is not null)
  )
);

alter table private.payment_checkout_rate_limits enable row level security;
revoke all on table private.payment_checkout_rate_limits
from public, anon, authenticated;

drop trigger if exists payment_checkout_rate_limits_set_updated_at
on private.payment_checkout_rate_limits;
create trigger payment_checkout_rate_limits_set_updated_at
before update on private.payment_checkout_rate_limits
for each row execute procedure private.set_updated_at();

create or replace function private.acquire_payment_checkout_lease(
  p_user_id uuid,
  p_now timestamptz default null
)
returns table (lease_token uuid, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_state private.payment_checkout_rate_limits%rowtype;
  v_lease_token uuid;
  v_retry_after integer;
begin
  if p_user_id is null then
    raise exception 'Checkout user is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kad_checkout:' || p_user_id::text, 0));

  insert into private.payment_checkout_rate_limits (
    user_id,
    window_started_at,
    attempt_count
  ) values (
    p_user_id,
    v_now,
    0
  )
  on conflict (user_id) do nothing;

  select rate_limit.*
  into v_state
  from private.payment_checkout_rate_limits as rate_limit
  where rate_limit.user_id = p_user_id
  for update;

  if v_state.lease_token is not null and v_state.lease_expires_at > v_now then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_state.lease_expires_at - v_now)))::integer
    );
    return query select null::uuid, v_retry_after;
    return;
  end if;

  v_lease_token := gen_random_uuid();
  update private.payment_checkout_rate_limits
  set
    lease_token = v_lease_token,
    lease_expires_at = v_now + interval '3 minutes'
  where user_id = p_user_id;

  return query select v_lease_token, 0;
end;
$$;
revoke all on function private.acquire_payment_checkout_lease(uuid, timestamptz)
from public;

create or replace function private.consume_payment_checkout_attempt(
  p_user_id uuid,
  p_lease_token uuid,
  p_now timestamptz default null
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_state private.payment_checkout_rate_limits%rowtype;
  v_retry_after integer;
begin
  if p_user_id is null or p_lease_token is null then
    raise exception 'Checkout lease is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kad_checkout:' || p_user_id::text, 0));

  select rate_limit.*
  into v_state
  from private.payment_checkout_rate_limits as rate_limit
  where rate_limit.user_id = p_user_id
  for update;

  if not found
     or v_state.lease_token is distinct from p_lease_token
     or v_state.lease_expires_at <= v_now then
    raise exception 'Checkout lease is invalid or expired';
  end if;

  if v_now >= v_state.window_started_at + interval '15 minutes' then
    v_state.window_started_at := v_now;
    v_state.attempt_count := 0;
  end if;

  if v_state.last_attempt_at is not null
     and v_now < v_state.last_attempt_at + interval '10 seconds' then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (
        v_state.last_attempt_at + interval '10 seconds' - v_now
      )))::integer
    );
    return query select false, v_retry_after;
    return;
  end if;

  if v_state.attempt_count >= 5 then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (
        v_state.window_started_at + interval '15 minutes' - v_now
      )))::integer
    );
    return query select false, v_retry_after;
    return;
  end if;

  update private.payment_checkout_rate_limits
  set
    window_started_at = v_state.window_started_at,
    attempt_count = v_state.attempt_count + 1,
    last_attempt_at = v_now
  where user_id = p_user_id;

  return query select true, 0;
end;
$$;
revoke all on function private.consume_payment_checkout_attempt(
  uuid, uuid, timestamptz
) from public;

create or replace function private.release_payment_checkout_lease(
  p_user_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_lease_token is null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kad_checkout:' || p_user_id::text, 0));

  update private.payment_checkout_rate_limits
  set
    lease_token = null,
    lease_expires_at = null
  where user_id = p_user_id
    and lease_token = p_lease_token;
end;
$$;
revoke all on function private.release_payment_checkout_lease(uuid, uuid)
from public;

create or replace function public.acquire_payment_checkout_lease(p_user_id uuid)
returns table (lease_token uuid, retry_after_seconds integer)
language sql
security definer
set search_path = ''
as $$
  select *
  from private.acquire_payment_checkout_lease(p_user_id, null);
$$;
revoke all on function public.acquire_payment_checkout_lease(uuid)
from public, anon, authenticated;
grant execute on function public.acquire_payment_checkout_lease(uuid)
to service_role;

create or replace function public.consume_payment_checkout_attempt(
  p_user_id uuid,
  p_lease_token uuid
)
returns table (allowed boolean, retry_after_seconds integer)
language sql
security definer
set search_path = ''
as $$
  select *
  from private.consume_payment_checkout_attempt(p_user_id, p_lease_token, null);
$$;
revoke all on function public.consume_payment_checkout_attempt(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.consume_payment_checkout_attempt(uuid, uuid)
to service_role;

create or replace function public.release_payment_checkout_lease(
  p_user_id uuid,
  p_lease_token uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.release_payment_checkout_lease(p_user_id, p_lease_token);
$$;
revoke all on function public.release_payment_checkout_lease(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.release_payment_checkout_lease(uuid, uuid)
to service_role;

alter table public.payment_transactions
add column if not exists credit_applied_at timestamptz,
add column if not exists provider_observed_at timestamptz,
add column if not exists terminal_status text,
add column if not exists terminal_observed_at timestamptz;

alter table public.payment_transactions
drop constraint if exists payment_transactions_terminal_status_check;
alter table public.payment_transactions
add constraint payment_transactions_terminal_status_check
check (terminal_status is null or terminal_status in ('refunded', 'charged_back'));

update public.payment_transactions
set
  credit_applied_at = case
    when provider_status = 'approved'
      or exists (
        select 1
        from public.subscriptions as subscription
        where subscription.last_payment_id = payment_transactions.provider_payment_id
      )
      then coalesce(paid_at, updated_at, created_at)
    else credit_applied_at
  end,
  provider_observed_at = coalesce(provider_observed_at, updated_at, paid_at, created_at),
  terminal_status = case
    when provider_status in ('refunded', 'charged_back') then provider_status
    else terminal_status
  end,
  terminal_observed_at = case
    when provider_status in ('refunded', 'charged_back')
      then coalesce(terminal_observed_at, updated_at, paid_at, created_at)
    else terminal_observed_at
  end;

create or replace function private.protect_payment_transaction_markers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.credit_applied_at is not null
     and new.credit_applied_at is distinct from old.credit_applied_at then
    raise exception 'Payment credit marker is immutable';
  end if;

  if old.terminal_status is not null
     and (
       new.terminal_status is distinct from old.terminal_status
       or new.terminal_observed_at is distinct from old.terminal_observed_at
     ) then
    raise exception 'Payment terminal marker is immutable';
  end if;

  if old.terminal_status is not null
     and old.credit_applied_at is null
     and new.credit_applied_at is not null then
    raise exception 'Terminal payment cannot grant credit';
  end if;

  return new;
end;
$$;
revoke all on function private.protect_payment_transaction_markers()
from public;

drop trigger if exists payment_transactions_protect_markers
on public.payment_transactions;
create trigger payment_transactions_protect_markers
before update on public.payment_transactions
for each row execute procedure private.protect_payment_transaction_markers();

drop function if exists public.apply_mercado_pago_payment(
  uuid, text, text, text, integer, text, timestamptz
);
drop function if exists private.apply_mercado_pago_payment(
  uuid, text, text, text, integer, text, timestamptz
);

create function private.apply_mercado_pago_payment(
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
    set status = 'approved'
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
    set status = 'canceled'
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
    set status = case when status = 'approved' then status else 'failed' end
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

create function public.apply_mercado_pago_payment(
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
language sql
security definer
set search_path = ''
as $$
  select private.apply_mercado_pago_payment(
    p_checkout_session_id,
    p_provider_payment_id,
    p_provider_subscription_id,
    p_provider_status,
    p_amount_cents,
    p_currency,
    p_paid_at,
    p_provider_observed_at
  );
$$;
revoke all on function public.apply_mercado_pago_payment(
  uuid, text, text, text, integer, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_mercado_pago_payment(
  uuid, text, text, text, integer, text, timestamptz, timestamptz
) to service_role;
