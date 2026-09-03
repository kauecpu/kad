-- Retain the old two-argument RPC for rollback compatibility. New callers must
-- supply the resource's last_modified, not the delivery time or browser clock.
create function public.sync_mercado_pago_subscription(
  p_provider_subscription_id text, p_provider_status text, p_provider_observed_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  checkout public.payment_checkout_sessions%rowtype;
begin
  if p_provider_observed_at is null or p_provider_status is null
     or p_provider_status not in ('pending','authorized','paused','cancelled','canceled') then
    raise exception 'Invalid provider subscription state';
  end if;
  for checkout in select * from public.payment_checkout_sessions
    where provider = 'mercado_pago' and provider_subscription_id = p_provider_subscription_id
    order by id for update
  loop
    if checkout.subscription_observed_at > p_provider_observed_at then return; end if;
    if checkout.subscription_observed_at = p_provider_observed_at
       and checkout.subscription_observed_status is distinct from p_provider_status then
      raise exception 'Conflicting subscription snapshots';
    end if;
  end loop;
  perform private.sync_mercado_pago_subscription(p_provider_subscription_id,p_provider_status);
  update public.payment_checkout_sessions set subscription_observed_at = p_provider_observed_at,
    subscription_observed_status = p_provider_status
  where provider = 'mercado_pago' and provider_subscription_id = p_provider_subscription_id;
end;
$$;
revoke all on function public.sync_mercado_pago_subscription(text,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.sync_mercado_pago_subscription(text,text,timestamptz) to service_role;

-- Read-only expiry: do not rewrite the paid period or financial ledger.
create function public.get_current_subscription()
returns table(plan text,billing_cycle text,provider text,status text,
  started_at timestamptz,current_period_end timestamptz,cancel_at_period_end boolean)
language sql stable security definer set search_path = '' as $$
  select s.plan,s.billing_cycle,s.provider,
    case when s.current_period_end <= now() then 'expired' else s.status end,
    s.started_at,s.current_period_end,s.cancel_at_period_end
  from public.subscriptions s where s.user_id = (select auth.uid());
$$;
revoke all on function public.get_current_subscription() from public,anon;
grant execute on function public.get_current_subscription() to authenticated;
