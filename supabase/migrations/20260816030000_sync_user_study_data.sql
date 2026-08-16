alter table public.profiles
add column if not exists avatar_path text;

alter table public.profiles drop constraint if exists profiles_avatar_path_format;
alter table public.profiles add constraint profiles_avatar_path_format
check (
  avatar_path is null
  or avatar_path ~ ('^' || id::text || '/avatar\.(jpg|jpeg|png|webp)$')
);

grant update (avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_avatars_select_own" on storage.objects;
create policy "profile_avatars_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "profile_avatars_insert_own" on storage.objects;
create policy "profile_avatars_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ ('^' || (select auth.uid())::text || '/avatar\.(jpg|jpeg|png|webp)$')
);

drop policy if exists "profile_avatars_update_own" on storage.objects;
create policy "profile_avatars_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ ('^' || (select auth.uid())::text || '/avatar\.(jpg|jpeg|png|webp)$')
);

drop policy if exists "profile_avatars_delete_own" on storage.objects;
create policy "profile_avatars_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create table if not exists public.essay_documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id text not null check (char_length(topic_id) between 1 and 120),
  content text not null default '' check (char_length(content) <= 30000),
  elapsed_seconds integer not null default 0 check (elapsed_seconds between 0 and 86400),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, topic_id),
  check ((status = 'submitted') = (submitted_at is not null))
);

alter table public.essay_documents enable row level security;

drop policy if exists "essay_documents_select_own" on public.essay_documents;
create policy "essay_documents_select_own" on public.essay_documents
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "essay_documents_insert_own" on public.essay_documents;
create policy "essay_documents_insert_own" on public.essay_documents
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "essay_documents_update_own" on public.essay_documents;
create policy "essay_documents_update_own" on public.essay_documents
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "essay_documents_delete_own" on public.essay_documents;
create policy "essay_documents_delete_own" on public.essay_documents
for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.essay_documents from public, anon, authenticated;
grant select, delete on public.essay_documents to authenticated;

drop trigger if exists essay_documents_set_updated_at on public.essay_documents;
create trigger essay_documents_set_updated_at
before update on public.essay_documents
for each row execute procedure private.set_updated_at();

create or replace function public.sync_essay_document(
  p_user_id uuid,
  p_topic_id text,
  p_content text,
  p_elapsed_seconds integer,
  p_status text,
  p_submitted_at timestamptz,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or v_user_id <> p_user_id then
    raise exception 'Authentication required';
  end if;

  insert into public.essay_documents (
    user_id, topic_id, content, elapsed_seconds, status, submitted_at, updated_at
  ) values (
    v_user_id, p_topic_id, p_content, p_elapsed_seconds, p_status, p_submitted_at, p_updated_at
  )
  on conflict (user_id, topic_id) do update set
    content = excluded.content,
    elapsed_seconds = excluded.elapsed_seconds,
    status = excluded.status,
    submitted_at = excluded.submitted_at,
    updated_at = excluded.updated_at
  where excluded.updated_at >= public.essay_documents.updated_at;
end;
$$;

revoke all on function public.sync_essay_document(uuid, text, text, integer, text, timestamptz, timestamptz)
from public, anon;
grant execute on function public.sync_essay_document(uuid, text, text, integer, text, timestamptz, timestamptz)
to authenticated;

create table if not exists public.simulation_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null check (char_length(session_id) between 1 and 120),
  status text not null check (status in ('active', 'paused', 'completed')),
  payload jsonb not null,
  created_at timestamptz not null,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, session_id),
  check (payload ->> 'id' = session_id),
  check (payload ->> 'status' = status),
  check (pg_column_size(payload) <= 262144),
  check ((status = 'completed') = (completed_at is not null))
);

create index if not exists simulation_sessions_user_updated_idx
on public.simulation_sessions (user_id, updated_at desc);

create unique index if not exists simulation_sessions_one_open_per_user_idx
on public.simulation_sessions (user_id)
where status <> 'completed';

alter table public.simulation_sessions enable row level security;

drop policy if exists "simulation_sessions_select_own" on public.simulation_sessions;
create policy "simulation_sessions_select_own" on public.simulation_sessions
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "simulation_sessions_insert_own" on public.simulation_sessions;
create policy "simulation_sessions_insert_own" on public.simulation_sessions
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "simulation_sessions_update_own" on public.simulation_sessions;
create policy "simulation_sessions_update_own" on public.simulation_sessions
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "simulation_sessions_delete_own" on public.simulation_sessions;
create policy "simulation_sessions_delete_own" on public.simulation_sessions
for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.simulation_sessions from public, anon, authenticated;
grant select, delete on public.simulation_sessions to authenticated;

drop trigger if exists simulation_sessions_set_updated_at on public.simulation_sessions;
create trigger simulation_sessions_set_updated_at
before update on public.simulation_sessions
for each row execute procedure private.set_updated_at();

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
begin
  if v_user_id is null or v_user_id <> p_user_id then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if p_status <> 'completed' then
    if exists (
      select 1
      from public.simulation_sessions as current_session
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
