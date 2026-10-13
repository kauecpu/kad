-- updated_at remains the client-visible sync cursor (old clients already use it).
-- persisted_at records server time independently. Never reuse the generic
-- set_updated_at trigger here: it destroys the ordering of offline snapshots.
alter table public.simulation_sessions add column if not exists persisted_at timestamptz;
drop trigger if exists simulation_sessions_set_updated_at on public.simulation_sessions;

-- Recover the version of legacy payloads where possible, without changing the
-- payload, answers or history. Invalid/missing legacy dates retain the old cursor.
do $$
declare
  item record;
  client_version timestamptz;
begin
  for item in select user_id, session_id, updated_at, payload
    from public.simulation_sessions where persisted_at is null for update
  loop
    client_version := item.updated_at;
    if jsonb_typeof(item.payload -> 'updatedAt') = 'string' then
      begin
        client_version := (item.payload ->> 'updatedAt')::timestamptz;
        if client_version is null or not isfinite(client_version) then
          client_version := item.updated_at;
        end if;
      exception when invalid_datetime_format or datetime_field_overflow then
        client_version := item.updated_at;
      end;
    end if;
    update public.simulation_sessions
      set persisted_at = item.updated_at, updated_at = client_version
      where user_id = item.user_id and session_id = item.session_id;
  end loop;
end;
$$;

alter table public.simulation_sessions alter column persisted_at set default now();
alter table public.simulation_sessions alter column persisted_at set not null;

create or replace function private.set_simulation_persisted_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.persisted_at := now();
  return new;
end;
$$;
revoke all on function private.set_simulation_persisted_at() from public, anon, authenticated, service_role;
drop trigger if exists simulation_sessions_set_persisted_at on public.simulation_sessions;
create trigger simulation_sessions_set_persisted_at
before insert or update on public.simulation_sessions
for each row execute procedure private.set_simulation_persisted_at();

-- Preserve the RPC signature and authorization introduced by the earlier migration.
create or replace function public.sync_simulation_session(
  p_user_id uuid, p_session_id text, p_status text, p_payload jsonb,
  p_created_at timestamptz, p_completed_at timestamptz, p_updated_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.simulation_sessions%rowtype;
begin
  if v_user_id is null or p_user_id is distinct from v_user_id then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if (p_payload ->> 'id') is distinct from p_session_id
    or (p_payload ->> 'status') is distinct from p_status then
    raise exception 'simulation_identity_mismatch' using errcode = '42501';
  end if;
  if p_updated_at is null or not isfinite(p_updated_at) then
    raise exception 'simulation_invalid_version' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select * into v_existing from public.simulation_sessions
    where user_id = v_user_id and session_id = p_session_id for update;
  if found then
    -- Equal versions are retries too: conflicting payloads cannot erase progress.
    if p_updated_at <= v_existing.updated_at then return; end if;
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
    select 1 from public.subscriptions s where s.user_id = v_user_id
      and s.plan in ('platinum', 'diamond', 'circle')
      and s.status in ('active', 'past_due', 'canceled') and s.current_period_end > now()
  ) then
    raise exception 'subscription_required' using errcode = '42501';
  end if;

  if p_status <> 'completed' then
    if exists (select 1 from public.simulation_sessions s
      where s.user_id = v_user_id and s.status <> 'completed'
        and s.session_id <> p_session_id and s.updated_at >= p_updated_at) then
      return;
    end if;
    delete from public.simulation_sessions s
      where s.user_id = v_user_id and s.status <> 'completed'
        and s.session_id <> p_session_id and s.updated_at < p_updated_at;
  end if;
  insert into public.simulation_sessions (
    user_id, session_id, status, payload, created_at, completed_at, updated_at
  ) values (
    v_user_id, p_session_id, p_status,
    jsonb_set(p_payload, '{updatedAt}', to_jsonb(p_updated_at)),
    p_created_at, p_completed_at, p_updated_at
  ) on conflict (user_id, session_id) do update set
    status = excluded.status, payload = excluded.payload,
    completed_at = excluded.completed_at, updated_at = excluded.updated_at
  where excluded.updated_at > public.simulation_sessions.updated_at;
end;
$$;
revoke all on function public.sync_simulation_session(uuid, text, text, jsonb, timestamptz, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.sync_simulation_session(uuid, text, text, jsonb, timestamptz, timestamptz, timestamptz)
  to authenticated;
