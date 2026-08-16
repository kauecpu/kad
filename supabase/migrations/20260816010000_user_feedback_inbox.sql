create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('problem', 'suggestion', 'question')),
  message text not null check (char_length(trim(message)) between 3 and 2000),
  source_screen text not null default 'unknown'
    check (char_length(trim(source_screen)) between 1 and 120),
  platform text not null default 'unknown'
    check (platform in ('android', 'ios', 'web', 'unknown')),
  app_version text check (
    app_version is null or char_length(trim(app_version)) between 1 and 40
  ),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'resolved')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_feedback_status_created_idx
on public.user_feedback (status, created_at desc);

create index if not exists user_feedback_user_created_idx
on public.user_feedback (user_id, created_at desc);

create index if not exists user_feedback_reviewed_by_idx
on public.user_feedback (reviewed_by);

alter table public.user_feedback enable row level security;
revoke all on table public.user_feedback from public, anon, authenticated;

drop trigger if exists user_feedback_set_updated_at on public.user_feedback;
create trigger user_feedback_set_updated_at
before update on public.user_feedback
for each row execute procedure private.set_updated_at();

create or replace function private.admin_permissions_for_role(p_role text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'owner' then array[
      'dashboard.read',
      'content.read', 'content.write', 'content.publish',
      'community.read', 'community.moderate',
      'feedback.read', 'feedback.manage',
      'users.read', 'users.manage',
      'audit.read', 'admins.manage'
    ]::text[]
    when 'admin' then array[
      'dashboard.read',
      'content.read', 'content.write', 'content.publish',
      'community.read', 'community.moderate',
      'feedback.read', 'feedback.manage',
      'users.read', 'users.manage',
      'audit.read'
    ]::text[]
    when 'editor' then array[
      'dashboard.read', 'content.read', 'content.write', 'content.publish'
    ]::text[]
    when 'moderator' then array[
      'dashboard.read', 'community.read', 'community.moderate',
      'feedback.read', 'feedback.manage'
    ]::text[]
    when 'support' then array[
      'dashboard.read', 'feedback.read', 'feedback.manage', 'users.read'
    ]::text[]
    else array[]::text[]
  end;
$$;

revoke all on function private.admin_permissions_for_role(text) from public;

create or replace function public.submit_user_feedback(
  p_category text,
  p_message text,
  p_source_screen text default 'unknown',
  p_platform text default 'unknown',
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_category text := trim(coalesce(p_category, ''));
  v_message text := trim(coalesce(p_message, ''));
  v_source_screen text := left(trim(coalesce(p_source_screen, 'unknown')), 120);
  v_platform text := lower(trim(coalesce(p_platform, 'unknown')));
  v_app_version text := nullif(left(trim(coalesce(p_app_version, '')), 40), '');
  v_feedback_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_category not in ('problem', 'suggestion', 'question') then
    raise exception 'Invalid feedback category' using errcode = '22023';
  end if;

  if char_length(v_message) < 3 or char_length(v_message) > 2000 then
    raise exception 'Feedback message must have between 3 and 2000 characters'
      using errcode = '22023';
  end if;

  if v_source_screen = '' then
    v_source_screen := 'unknown';
  end if;

  if v_platform not in ('android', 'ios', 'web', 'unknown') then
    v_platform := 'unknown';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if (
    select count(*)
    from public.user_feedback
    where user_id = v_user_id
      and created_at >= timezone('utc', now()) - interval '1 hour'
  ) >= 5 then
    raise exception 'Feedback rate limit exceeded' using errcode = 'P0001';
  end if;

  insert into public.user_feedback (
    user_id, category, message, source_screen, platform, app_version
  ) values (
    v_user_id, v_category, v_message, v_source_screen, v_platform, v_app_version
  )
  returning id into v_feedback_id;

  return v_feedback_id;
end;
$$;

create or replace function public.admin_list_user_feedback()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.has_admin_permission('feedback.read') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item order by item->>'createdAt' desc), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'id', feedback.id,
      'userId', feedback.user_id,
      'userName', coalesce(nullif(trim(profile.name), ''), 'Estudante'),
      'username', profile.username,
      'category', feedback.category,
      'message', feedback.message,
      'sourceScreen', feedback.source_screen,
      'platform', feedback.platform,
      'appVersion', feedback.app_version,
      'status', feedback.status,
      'createdAt', feedback.created_at,
      'updatedAt', feedback.updated_at
    ) as item
    from public.user_feedback as feedback
    left join public.profiles as profile on profile.id = feedback.user_id
  ) as feedback_items;

  return result;
end;
$$;

create or replace function public.admin_update_user_feedback_status(
  p_feedback_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_previous_status text;
begin
  if not private.has_admin_permission('feedback.manage') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  if v_status not in ('new', 'reviewing', 'resolved') then
    raise exception 'Invalid feedback status' using errcode = '22023';
  end if;

  select status
  into v_previous_status
  from public.user_feedback
  where id = p_feedback_id
  for update;

  if v_previous_status is null then
    raise exception 'Feedback not found' using errcode = 'P0002';
  end if;

  update public.user_feedback
  set
    status = v_status,
    reviewed_by = case when v_status = 'new' then null else auth.uid() end,
    reviewed_at = case when v_status = 'new' then null else timezone('utc', now()) end
  where id = p_feedback_id;

  insert into private.admin_audit_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    auth.uid(),
    'feedback.status_updated',
    'user_feedback',
    p_feedback_id::text,
    jsonb_build_object(
      'previous_status', v_previous_status,
      'status', v_status
    )
  );
end;
$$;

revoke all on function public.submit_user_feedback(text, text, text, text, text)
from public, anon, authenticated;
revoke all on function public.admin_list_user_feedback()
from public, anon, authenticated;
revoke all on function public.admin_update_user_feedback_status(uuid, text)
from public, anon, authenticated;

grant execute on function public.submit_user_feedback(text, text, text, text, text)
to authenticated;
grant execute on function public.admin_list_user_feedback()
to authenticated;
grant execute on function public.admin_update_user_feedback_status(uuid, text)
to authenticated;

comment on table public.user_feedback is
'Authenticated product feedback submitted in the KAD app and triaged through protected admin RPCs.';
