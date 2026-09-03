-- A short database claim, not a transaction held across provider HTTP calls.
-- Existing events and financial records are preserved.
alter table public.payment_webhook_events
  add column processing_token uuid,
  add column lease_expires_at timestamptz,
  add column attempts integer not null default 0;

create function public.claim_payment_webhook(
  p_event_key text, p_event_type text, p_action text,
  p_resource_id text, p_live_mode boolean
)
returns table(outcome text, token uuid)
language plpgsql security definer set search_path = '' as $$
declare
  event public.payment_webhook_events%rowtype;
  new_token uuid := gen_random_uuid();
begin
  if p_event_key is null or char_length(p_event_key) > 600
     or p_event_type is null or p_event_type !~ '^[A-Za-z0-9_.:-]{1,80}$'
     or p_resource_id is null or char_length(p_resource_id) not between 1 and 200 then
    raise exception 'Invalid webhook claim';
  end if;
  insert into public.payment_webhook_events
    (provider_event_key,event_type,action,resource_id,live_mode)
  values (p_event_key,p_event_type,p_action,p_resource_id,p_live_mode)
  on conflict (provider_event_key) do nothing;

  select * into event from public.payment_webhook_events
  where provider_event_key = p_event_key for update;
  if event.event_type <> p_event_type or event.resource_id <> p_resource_id
     or event.live_mode is distinct from p_live_mode then
    raise exception 'Webhook identity conflict';
  end if;
  if event.processed then
    return query select 'duplicate'::text, null::uuid;
  elsif event.lease_expires_at > clock_timestamp() then
    return query select 'busy'::text, null::uuid;
  else
    update public.payment_webhook_events set processing_token = new_token,
      lease_expires_at = clock_timestamp() + interval '2 minutes',
      attempts = attempts + 1, error_code = null
    where provider_event_key = p_event_key;
    return query select 'claimed'::text, new_token;
  end if;
end;
$$;

create function public.finish_payment_webhook(
  p_event_key text, p_token uuid, p_processed boolean, p_error_code text
)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_processed is null or (p_processed and p_error_code is not null)
     or (not p_processed and (p_error_code is null or p_error_code not in ('not_correlated','processing_failed'))) then
    raise exception 'Invalid webhook outcome';
  end if;
  update public.payment_webhook_events set processed = p_processed,
    processed_at = case when p_processed then clock_timestamp() else null end,
    error_code = p_error_code, processing_token = null, lease_expires_at = null
  where provider_event_key = p_event_key and processing_token = p_token
    and not processed;
  return found;
end;
$$;

revoke all on function public.claim_payment_webhook(text,text,text,text,boolean)
  from public, anon, authenticated;
revoke all on function public.finish_payment_webhook(text,uuid,boolean,text)
  from public, anon, authenticated;
grant execute on function public.claim_payment_webhook(text,text,text,text,boolean) to service_role;
grant execute on function public.finish_payment_webhook(text,uuid,boolean,text) to service_role;
