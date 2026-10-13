-- Preserve the public RPC signature, RLS and existing records. No backfill.
-- Authorization precedes all writes, including removal of an older open session.
create or replace function public.sync_simulation_session(
  p_user_id uuid,
  p_session_id text,
  p_status text,
  p_payload jsonb,
  p_created_at timestamptz,
  p_completed_at timestamptz,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.simulation_sessions%rowtype;
begin
  if v_user_id is null or p_user_id is distinct from v_user_id then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- Readers consume the JSON snapshot, so it must match the protected row.
  if (p_payload ->> 'id') is distinct from p_session_id
    or (p_payload ->> 'status') is distinct from p_status then
    raise exception 'simulation_identity_mismatch' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select * into v_existing
  from public.simulation_sessions
  where user_id = v_user_id and session_id = p_session_id
  for update;

  if found then
    -- Retrying an older offline snapshot must never roll back newer progress.
    if p_updated_at < v_existing.updated_at then
      return;
    end if;
    -- Existing sessions may finish after expiry, but cannot become a new exam.
    if p_created_at is distinct from v_existing.created_at
      or (p_payload -> 'createdAt') is distinct from (v_existing.payload -> 'createdAt')
      or (p_payload -> 'config') is distinct from (v_existing.payload -> 'config')
      or (p_payload -> 'questions') is distinct from (v_existing.payload -> 'questions') then
      raise exception 'simulation_snapshot_immutable' using errcode = '42501';
    end if;
    if v_existing.status = 'completed' and p_status <> 'completed' then
      raise exception 'simulation_already_completed' using errcode = '42501';
    end if;
  elsif not exists (
    select 1 from public.subscriptions s
    where s.user_id = v_user_id
      and s.plan in ('platinum', 'diamond', 'circle') -- Honor legacy entitlements; no new product.
      and s.status in ('active', 'past_due', 'canceled')
      and s.current_period_end > now()
  ) then
    raise exception 'subscription_required' using errcode = '42501';
  end if;

  if p_status <> 'completed' then
    if exists (
      select 1 from public.simulation_sessions as current_session
      where current_session.user_id = v_user_id
        and current_session.status <> 'completed'
        and current_session.session_id <> p_session_id
        and current_session.updated_at > p_updated_at
    ) then
      return;
    end if;
    delete from public.simulation_sessions as stale_session
    where stale_session.user_id = v_user_id
      and stale_session.status <> 'completed'
      and stale_session.session_id <> p_session_id
      and stale_session.updated_at <= p_updated_at;
  end if;

  insert into public.simulation_sessions (
    user_id, session_id, status, payload, created_at, completed_at, updated_at
  ) values (
    v_user_id, p_session_id, p_status, p_payload, p_created_at, p_completed_at, p_updated_at
  )
  on conflict (user_id, session_id) do update set
    status = excluded.status,
    payload = excluded.payload,
    completed_at = excluded.completed_at,
    updated_at = excluded.updated_at
  where excluded.updated_at >= public.simulation_sessions.updated_at;
end;
$$;

revoke all on function public.sync_simulation_session(uuid, text, text, jsonb, timestamptz, timestamptz, timestamptz)
from public, anon;
grant execute on function public.sync_simulation_session(uuid, text, text, jsonb, timestamptz, timestamptz, timestamptz)
to authenticated;
