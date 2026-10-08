begin;

-- Backend-only policy. Clients cannot choose an operation's quota or identity.
create table if not exists private.abuse_limit_policies (
  operation text primary key check (operation in (
    'google_purchase_validate', 'subscription_cancel', 'account_delete'
  )),
  max_attempts integer not null check (max_attempts between 1 and 1000),
  window_seconds integer not null check (window_seconds between 10 and 86400)
);
insert into private.abuse_limit_policies values
  ('google_purchase_validate', 30, 300),
  ('subscription_cancel', 5, 900),
  ('account_delete', 5, 900)
on conflict (operation) do nothing;

create table if not exists private.abuse_limit_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null references private.abuse_limit_policies(operation),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts >= 0),
  expires_at timestamptz not null,
  primary key (user_id, operation)
);
create index if not exists abuse_limit_counters_expiry_idx
  on private.abuse_limit_counters(expires_at);
alter table private.abuse_limit_policies enable row level security;
alter table private.abuse_limit_counters enable row level security;
revoke all on private.abuse_limit_policies, private.abuse_limit_counters
  from public, anon, authenticated, service_role;

-- Bounded, opportunistic retention; skips rows used by other requests.
create or replace function private.prune_abuse_limit_counters()
returns void language sql security definer set search_path = '' as $$
  delete from private.abuse_limit_counters
  where (user_id, operation) in (
    select user_id, operation from private.abuse_limit_counters
    where expires_at < clock_timestamp()
    order by expires_at limit 32 for update skip locked
  );
$$;
revoke all on function private.prune_abuse_limit_counters()
  from public, anon, authenticated, service_role;

create or replace function public.consume_abuse_limit(p_user_id uuid, p_operation text)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_policy private.abuse_limit_policies%rowtype;
  v_counter private.abuse_limit_counters%rowtype;
  v_now timestamptz;
begin
  if p_user_id is null then raise exception 'Authenticated user required'; end if;
  select * into strict v_policy from private.abuse_limit_policies
    where operation = p_operation;
  -- Same key coordinates all Edge instances; clock is sampled AFTER the lock.
  perform pg_advisory_xact_lock(hashtextextended('kad_abuse:' || p_operation || ':' || p_user_id::text, 0));
  v_now := clock_timestamp();
  perform private.prune_abuse_limit_counters();
  insert into private.abuse_limit_counters values (
    p_user_id, p_operation, v_now, 0,
    v_now + make_interval(secs => v_policy.window_seconds) + interval '24 hours'
  ) on conflict (user_id, operation) do nothing;
  select * into strict v_counter from private.abuse_limit_counters
    where user_id = p_user_id and operation = p_operation for update;
  if v_now >= v_counter.window_started_at + make_interval(secs => v_policy.window_seconds) then
    v_counter.window_started_at := v_now;
    v_counter.attempts := 0;
  end if;
  if v_counter.attempts >= v_policy.max_attempts then
    return query select false, greatest(1, ceil(extract(epoch from (
      v_counter.window_started_at + make_interval(secs => v_policy.window_seconds) - v_now
    )))::integer);
    return;
  end if;
  update private.abuse_limit_counters set
    window_started_at = v_counter.window_started_at,
    attempts = v_counter.attempts + 1,
    expires_at = v_counter.window_started_at + make_interval(secs => v_policy.window_seconds) + interval '24 hours'
    where user_id = p_user_id and operation = p_operation;
  return query select true, 0;
end;
$$;
revoke all on function public.consume_abuse_limit(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_abuse_limit(uuid, text) to service_role;

commit;
