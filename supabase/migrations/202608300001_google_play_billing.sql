-- Google Play subscriptions are verified by an Edge Function and applied here
-- under a single idempotent transaction. The app never writes these tables.

alter table public.payment_checkout_sessions
  drop constraint if exists payment_checkout_sessions_plan_check;
alter table public.payment_checkout_sessions
  add constraint payment_checkout_sessions_plan_check
  check (plan in ('platinum', 'diamond', 'circle'));

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('platinum', 'diamond', 'circle'));

create table if not exists public.google_play_purchases (
  purchase_token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  order_id text,
  provider_status text not null,
  expires_at timestamptz,
  auto_renew boolean not null default false,
  entitled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists google_play_purchases_user_idx
on public.google_play_purchases (user_id, updated_at desc);

alter table public.google_play_purchases enable row level security;
revoke all on public.google_play_purchases from public, anon, authenticated, service_role;

drop trigger if exists google_play_purchases_set_updated_at
on public.google_play_purchases;
create trigger google_play_purchases_set_updated_at
before update on public.google_play_purchases
for each row execute procedure private.set_updated_at();

create or replace function private.apply_google_play_purchase(
  p_user_id uuid,
  p_purchase_token text,
  p_product_id text,
  p_order_id text,
  p_provider_status text,
  p_expires_at timestamptz,
  p_auto_renew boolean,
  p_entitled boolean
)
returns table (
  entitled boolean,
  subscription_status text,
  current_period_end timestamptz,
  auto_renew boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_purchase public.google_play_purchases%rowtype;
  existing_subscription public.subscriptions%rowtype;
  purchase_plan text;
  purchase_cycle text;
  next_status text;
begin
  if p_user_id is null
     or nullif(btrim(p_purchase_token), '') is null
     or char_length(p_purchase_token) > 4096
     or p_product_id not in (
       'kad_platinum_monthly', 'kad_platinum_quarterly', 'kad_platinum_annual',
       'kad_diamond_monthly', 'kad_diamond_quarterly', 'kad_diamond_annual'
     )
     or p_provider_status not in ('active', 'past_due', 'canceled', 'expired')
     or (p_entitled and p_expires_at is null) then
    raise exception 'Invalid Google Play purchase data';
  end if;

  purchase_plan := case
    when p_product_id like 'kad_platinum_%' then 'platinum'
    else 'diamond'
  end;
  purchase_cycle := split_part(p_product_id, '_', 3);

  perform pg_advisory_xact_lock(
    hashtextextended('google_play_purchase:' || p_purchase_token, 0)
  );

  select * into existing_purchase
  from public.google_play_purchases
  where purchase_token = p_purchase_token
  for update;

  if found and (
    existing_purchase.user_id <> p_user_id
    or existing_purchase.product_id <> p_product_id
  ) then
    raise exception 'Google Play purchase belongs to another account';
  end if;

  select * into existing_subscription
  from public.subscriptions
  where provider_subscription_id = p_purchase_token
  for update;
  if found and existing_subscription.user_id <> p_user_id then
    raise exception 'Google Play purchase is already linked to another account';
  end if;

  insert into public.google_play_purchases (
    purchase_token, user_id, product_id, order_id, provider_status,
    expires_at, auto_renew, entitled
  ) values (
    p_purchase_token, p_user_id, p_product_id, p_order_id, p_provider_status,
    p_expires_at, p_auto_renew, p_entitled
  )
  on conflict (purchase_token) do update set
    order_id = excluded.order_id,
    provider_status = excluded.provider_status,
    expires_at = excluded.expires_at,
    auto_renew = excluded.auto_renew,
    entitled = excluded.entitled;

  next_status := case when p_entitled then p_provider_status else 'expired' end;
  insert into public.subscriptions (
    user_id, plan, billing_cycle, provider, provider_subscription_id,
    provider_status, status, started_at, current_period_end,
    cancel_at_period_end, last_payment_id, last_payment_at
  ) values (
    p_user_id, purchase_plan, purchase_cycle, 'google', p_purchase_token,
    p_provider_status, next_status, timezone('utc', now()),
    coalesce(p_expires_at, timezone('utc', now())), not p_auto_renew,
    p_order_id, timezone('utc', now())
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    billing_cycle = excluded.billing_cycle,
    provider = excluded.provider,
    provider_subscription_id = excluded.provider_subscription_id,
    provider_status = excluded.provider_status,
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    last_payment_id = excluded.last_payment_id,
    last_payment_at = excluded.last_payment_at;

  return query select
    p_entitled,
    next_status,
    p_expires_at,
    p_auto_renew;
end;
$$;
revoke all on function private.apply_google_play_purchase(
  uuid, text, text, text, text, timestamptz, boolean, boolean
) from public;

create or replace function public.apply_google_play_purchase(
  p_user_id uuid,
  p_purchase_token text,
  p_product_id text,
  p_order_id text,
  p_provider_status text,
  p_expires_at timestamptz,
  p_auto_renew boolean,
  p_entitled boolean
)
returns table (
  entitled boolean,
  subscription_status text,
  current_period_end timestamptz,
  auto_renew boolean
)
language sql
security definer
set search_path = ''
as $$
  select * from private.apply_google_play_purchase(
    p_user_id, p_purchase_token, p_product_id, p_order_id,
    p_provider_status, p_expires_at, p_auto_renew, p_entitled
  );
$$;
revoke all on function public.apply_google_play_purchase(
  uuid, text, text, text, text, timestamptz, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.apply_google_play_purchase(
  uuid, text, text, text, text, timestamptz, boolean, boolean
) to service_role;
