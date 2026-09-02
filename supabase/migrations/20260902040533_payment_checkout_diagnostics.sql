alter table public.payment_checkout_sessions
add column if not exists status_reason text;

alter table public.payment_checkout_sessions
drop constraint if exists payment_checkout_sessions_status_reason_check;
alter table public.payment_checkout_sessions
add constraint payment_checkout_sessions_status_reason_check
check (
  status_reason is null or status_reason in (
    'configuration_missing',
    'provider_credentials_rejected',
    'provider_request_rejected',
    'provider_rate_limited',
    'provider_unavailable',
    'provider_invalid_response',
    'internal_error',
    'payment_rejected',
    'payment_refunded',
    'payment_chargeback',
    'subscription_canceled',
    'checkout_replaced'
  )
);

create or replace function public.get_payment_checkout_status(p_checkout_id uuid)
returns table (
  status text,
  status_reason text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when checkout.status in ('creating', 'pending')
        and checkout.expires_at <= timezone('utc', now()) then 'expired'
      else checkout.status
    end,
    checkout.status_reason,
    checkout.updated_at
  from public.payment_checkout_sessions as checkout
  where checkout.id = p_checkout_id
    and checkout.user_id = (select auth.uid());
$$;

revoke all on function public.get_payment_checkout_status(uuid)
from public, anon, authenticated;
grant execute on function public.get_payment_checkout_status(uuid)
to authenticated;
