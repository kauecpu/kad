create table if not exists public.payment_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('diamond', 'circle')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'quarterly', 'annual')),
  provider text not null check (provider in ('mercado_pago', 'apple', 'google')),
  provider_subscription_id text unique,
  checkout_url text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = upper(currency) and char_length(currency) = 3),
  status text not null default 'creating'
    check (status in ('creating', 'pending', 'approved', 'failed', 'canceled', 'expired')),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '1 hour'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists payment_checkout_sessions_user_created_idx
on public.payment_checkout_sessions (user_id, created_at desc);

create unique index if not exists payment_checkout_sessions_open_user_idx
on public.payment_checkout_sessions (user_id)
where status in ('creating', 'pending');

alter table public.payment_checkout_sessions enable row level security;
revoke all on public.payment_checkout_sessions from anon, authenticated;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('diamond', 'circle')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'quarterly', 'annual')),
  provider text not null check (provider in ('mercado_pago', 'apple', 'google')),
  provider_subscription_id text not null unique,
  provider_status text not null,
  status text not null
    check (status in ('active', 'past_due', 'canceled', 'expired')),
  started_at timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  last_payment_id text,
  last_payment_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists subscriptions_provider_subscription_idx
on public.subscriptions (provider, provider_subscription_id);

alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
on public.subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.subscriptions from anon, authenticated;
grant select (
  user_id,
  plan,
  billing_cycle,
  provider,
  provider_status,
  status,
  started_at,
  current_period_end,
  cancel_at_period_end,
  updated_at
) on public.subscriptions to authenticated;

create table if not exists public.payment_transactions (
  provider_payment_id text primary key,
  checkout_session_id uuid references public.payment_checkout_sessions (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  provider_subscription_id text not null,
  provider_status text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency = upper(currency) and char_length(currency) = 3),
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists payment_transactions_user_created_idx
on public.payment_transactions (user_id, created_at desc);

alter table public.payment_transactions enable row level security;
revoke all on public.payment_transactions from anon, authenticated;

create table if not exists public.payment_webhook_events (
  provider_event_key text primary key,
  event_type text not null,
  action text,
  resource_id text not null,
  live_mode boolean,
  processed boolean not null default false,
  error_code text,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

alter table public.payment_webhook_events enable row level security;
revoke all on public.payment_webhook_events from anon, authenticated;

drop trigger if exists payment_checkout_sessions_set_updated_at
on public.payment_checkout_sessions;
create trigger payment_checkout_sessions_set_updated_at
before update on public.payment_checkout_sessions
for each row execute procedure private.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute procedure private.set_updated_at();

drop trigger if exists payment_transactions_set_updated_at
on public.payment_transactions;
create trigger payment_transactions_set_updated_at
before update on public.payment_transactions
for each row execute procedure private.set_updated_at();

create or replace function private.payment_period_end(
  p_started_at timestamptz,
  p_billing_cycle text
)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case p_billing_cycle
    when 'monthly' then p_started_at + interval '1 month'
    when 'quarterly' then p_started_at + interval '3 months'
    when 'annual' then p_started_at + interval '1 year'
    else null
  end;
$$;
revoke all on function private.payment_period_end(timestamptz, text) from public;

create or replace function private.apply_mercado_pago_payment(
  p_checkout_session_id uuid,
  p_provider_payment_id text,
  p_provider_subscription_id text,
  p_provider_status text,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz default null
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
begin
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
  if checkout.amount_cents <> p_amount_cents or checkout.currency <> upper(p_currency) then
    raise exception 'Payment amount does not match checkout';
  end if;

  select *
  into previous_transaction
  from public.payment_transactions
  where provider_payment_id = p_provider_payment_id
  for update;

  if found then
    should_extend := previous_transaction.provider_status <> 'approved'
      and p_provider_status = 'approved';
    update public.payment_transactions
    set
      provider_status = p_provider_status,
      provider_subscription_id = p_provider_subscription_id,
      paid_at = coalesce(p_paid_at, paid_at)
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
      paid_at
    ) values (
      p_provider_payment_id,
      checkout.id,
      checkout.user_id,
      p_provider_subscription_id,
      p_provider_status,
      p_amount_cents,
      upper(p_currency),
      p_paid_at
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
  elsif p_provider_status in ('refunded', 'charged_back') then
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
  uuid, text, text, text, integer, text, timestamptz
) from public;

create or replace function public.apply_mercado_pago_payment(
  p_checkout_session_id uuid,
  p_provider_payment_id text,
  p_provider_subscription_id text,
  p_provider_status text,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz default null
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
    p_paid_at
  );
$$;
revoke all on function public.apply_mercado_pago_payment(
  uuid, text, text, text, integer, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_mercado_pago_payment(
  uuid, text, text, text, integer, text, timestamptz
) to service_role;

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
  set status = case p_provider_status
    when 'pending' then 'pending'
    when 'authorized' then status
    when 'paused' then status
    when 'cancelled' then 'canceled'
    when 'canceled' then 'canceled'
    else status
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
revoke all on function private.sync_mercado_pago_subscription(text, text) from public;

create or replace function public.sync_mercado_pago_subscription(
  p_provider_subscription_id text,
  p_provider_status text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.sync_mercado_pago_subscription(
    p_provider_subscription_id,
    p_provider_status
  );
$$;
revoke all on function public.sync_mercado_pago_subscription(text, text)
from public, anon, authenticated;
grant execute on function public.sync_mercado_pago_subscription(text, text)
to service_role;
