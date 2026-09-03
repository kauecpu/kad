create or replace function public.get_latest_open_payment_checkout()
returns table (
  checkout_id uuid,
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
    checkout.id,
    case
      when checkout.expires_at <= timezone('utc', now()) then 'expired'
      else checkout.status
    end,
    checkout.status_reason,
    checkout.updated_at
  from public.payment_checkout_sessions as checkout
  where checkout.user_id = (select auth.uid())
    and checkout.provider = 'mercado_pago'
    and checkout.status in ('creating', 'pending')
  order by checkout.created_at desc
  limit 1;
$$;

revoke all on function public.get_latest_open_payment_checkout()
from public, anon, authenticated;
grant execute on function public.get_latest_open_payment_checkout()
to authenticated;
