create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'moderator', 'support')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users (id) on delete set null
);

alter table private.admin_users enable row level security;
revoke all on table private.admin_users from public, anon, authenticated;

create table if not exists private.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 3 and 120),
  resource_type text not null check (char_length(resource_type) between 2 and 80),
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_audit_logs_created_idx
on private.admin_audit_logs (created_at desc);

alter table private.admin_audit_logs enable row level security;
revoke all on table private.admin_audit_logs from public, anon, authenticated;

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
      'users.read', 'users.manage',
      'audit.read', 'admins.manage'
    ]::text[]
    when 'admin' then array[
      'dashboard.read',
      'content.read', 'content.write', 'content.publish',
      'community.read', 'community.moderate',
      'users.read', 'users.manage',
      'audit.read'
    ]::text[]
    when 'editor' then array[
      'dashboard.read', 'content.read', 'content.write', 'content.publish'
    ]::text[]
    when 'moderator' then array[
      'dashboard.read', 'community.read', 'community.moderate'
    ]::text[]
    when 'support' then array[
      'dashboard.read', 'users.read'
    ]::text[]
    else array[]::text[]
  end;
$$;

revoke all on function private.admin_permissions_for_role(text) from public;

create or replace function private.has_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_users as admin_user
    where admin_user.user_id = auth.uid()
      and admin_user.active
      and p_permission = any(private.admin_permissions_for_role(admin_user.role))
  );
$$;

revoke all on function private.has_admin_permission(text) from public;

create or replace function public.get_my_admin_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'role', admin_user.role,
    'permissions', private.admin_permissions_for_role(admin_user.role)
  )
  from private.admin_users as admin_user
  where admin_user.user_id = auth.uid()
    and admin_user.active;
$$;

revoke all on function public.get_my_admin_access() from public, anon;
grant execute on function public.get_my_admin_access() to authenticated;

create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.has_admin_permission('dashboard.read') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_last_7_days', (
      select count(*) from public.profiles
      where created_at >= timezone('utc', now()) - interval '7 days'
    ),
    'question_attempts_total', (select count(*) from public.question_attempts),
    'active_students_last_7_days', (
      select count(distinct user_id) from public.question_attempts
      where answered_at >= timezone('utc', now()) - interval '7 days'
    ),
    'saved_concursos_total', (select count(*) from public.saved_concursos),
    'comments_total', (select count(*) from public.question_comments),
    'comments_last_7_days', (
      select count(*) from public.question_comments
      where created_at >= timezone('utc', now()) - interval '7 days'
    ),
    'generated_at', timezone('utc', now())
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard_summary() from public, anon;
grant execute on function public.admin_dashboard_summary() to authenticated;

comment on table private.admin_users is
'Administrative access list. Rows must only be managed from trusted server-side environments.';

comment on table private.admin_audit_logs is
'Append-only audit trail for privileged KAD administration actions.';
