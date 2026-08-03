create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(split_part(new.email, '@', 1), ''),
        'Estudante'
      ),
      120
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();

drop function if exists public.delete_own_account();
drop policy if exists "profiles_delete_own" on public.profiles;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert (id, name, phone, city, target_role) on public.profiles to authenticated;
grant update (name, phone, city, target_role) on public.profiles to authenticated;
alter table public.profiles drop column if exists avatar_url;
alter table public.profiles drop constraint if exists profiles_phone_length;
alter table public.profiles add constraint profiles_phone_length
check (phone is null or char_length(phone) <= 30);
alter table public.profiles drop constraint if exists profiles_city_length;
alter table public.profiles add constraint profiles_city_length
check (city is null or char_length(city) <= 120);
alter table public.profiles drop constraint if exists profiles_target_role_length;
alter table public.profiles add constraint profiles_target_role_length
check (target_role is null or char_length(target_role) <= 160);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public;

drop trigger if exists profiles_set_updated_at on public.profiles;
drop function if exists public.set_profile_updated_at();
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure private.set_updated_at();

create table if not exists public.question_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 120),
  subject text not null check (char_length(subject) between 1 and 160),
  selected text not null check (selected in ('A', 'B', 'C', 'D', 'E')),
  is_correct boolean not null,
  answered_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, question_id)
);

alter table public.question_attempts enable row level security;
drop policy if exists "question_attempts_select_own" on public.question_attempts;
create policy "question_attempts_select_own" on public.question_attempts
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "question_attempts_insert_own" on public.question_attempts;
create policy "question_attempts_insert_own" on public.question_attempts
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "question_attempts_update_own" on public.question_attempts;
create policy "question_attempts_update_own" on public.question_attempts
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "question_attempts_delete_own" on public.question_attempts;
create policy "question_attempts_delete_own" on public.question_attempts
for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.question_attempts to authenticated;

create table if not exists public.question_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 120),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, question_id)
);

alter table public.question_favorites enable row level security;
drop policy if exists "question_favorites_own" on public.question_favorites;
create policy "question_favorites_own" on public.question_favorites
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
grant select, insert, delete on public.question_favorites to authenticated;

create table if not exists public.saved_concursos (
  user_id uuid not null references auth.users (id) on delete cascade,
  concurso_id text not null check (char_length(concurso_id) between 1 and 120),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, concurso_id)
);

alter table public.saved_concursos enable row level security;
drop policy if exists "saved_concursos_own" on public.saved_concursos;
create policy "saved_concursos_own" on public.saved_concursos
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
grant select, insert, delete on public.saved_concursos to authenticated;

create table if not exists public.question_comments (
  id uuid primary key default gen_random_uuid(),
  question_id text not null check (char_length(question_id) between 1 and 120),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(trim(author_name)) between 1 and 120),
  text text not null check (char_length(trim(text)) between 1 and 500),
  likes_count integer not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists question_comments_question_created_idx
on public.question_comments (question_id, created_at desc);

alter table public.question_comments enable row level security;
drop policy if exists "question_comments_read_authenticated" on public.question_comments;
create policy "question_comments_read_authenticated" on public.question_comments
for select to authenticated using (true);
drop policy if exists "question_comments_insert_own" on public.question_comments;
create policy "question_comments_insert_own" on public.question_comments
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "question_comments_update_own" on public.question_comments;
create policy "question_comments_update_own" on public.question_comments
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "question_comments_delete_own" on public.question_comments;
create policy "question_comments_delete_own" on public.question_comments
for delete to authenticated using ((select auth.uid()) = user_id);
grant select on public.question_comments to authenticated;
grant insert (question_id, user_id, author_name, text) on public.question_comments to authenticated;
grant update (text) on public.question_comments to authenticated;
grant delete on public.question_comments to authenticated;

create or replace function private.set_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select profile.name
  into new.author_name
  from public.profiles as profile
  where profile.id = new.user_id;

  new.author_name = coalesce(nullif(trim(new.author_name), ''), 'Estudante');
  return new;
end;
$$;
revoke all on function private.set_comment_author() from public;

drop trigger if exists question_comments_set_author on public.question_comments;
create trigger question_comments_set_author
before insert on public.question_comments
for each row execute procedure private.set_comment_author();

drop trigger if exists question_comments_set_updated_at on public.question_comments;
create trigger question_comments_set_updated_at
before update of text on public.question_comments
for each row execute procedure private.set_updated_at();

create table if not exists public.comment_likes (
  comment_id uuid not null references public.question_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (comment_id, user_id)
);

alter table public.comment_likes enable row level security;
drop policy if exists "comment_likes_select_own" on public.comment_likes;
create policy "comment_likes_select_own" on public.comment_likes
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "comment_likes_insert_own" on public.comment_likes;
create policy "comment_likes_insert_own" on public.comment_likes
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "comment_likes_delete_own" on public.comment_likes;
create policy "comment_likes_delete_own" on public.comment_likes
for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, delete on public.comment_likes to authenticated;

create or replace function private.update_comment_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.question_comments
    set likes_count = likes_count + 1
    where id = new.comment_id;
    return new;
  end if;

  update public.question_comments
  set likes_count = greatest(0, likes_count - 1)
  where id = old.comment_id;
  return old;
end;
$$;
revoke all on function private.update_comment_likes_count() from public;

drop trigger if exists comment_likes_count_insert on public.comment_likes;
create trigger comment_likes_count_insert
after insert on public.comment_likes
for each row execute procedure private.update_comment_likes_count();
drop trigger if exists comment_likes_count_delete on public.comment_likes;
create trigger comment_likes_count_delete
after delete on public.comment_likes
for each row execute procedure private.update_comment_likes_count();

create or replace function private.question_community_accuracy(p_question_ids text[])
returns table (
  question_id text,
  total_answers bigint,
  correct_answers bigint,
  accuracy integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    attempt.question_id,
    count(*) as total_answers,
    count(*) filter (where attempt.is_correct) as correct_answers,
    round(100.0 * count(*) filter (where attempt.is_correct) / count(*))::integer as accuracy
  from public.question_attempts as attempt
  where cardinality(p_question_ids) between 1 and 100
    and attempt.question_id = any (p_question_ids)
  group by attempt.question_id;
$$;

revoke all on function private.question_community_accuracy(text[]) from public;
grant execute on function private.question_community_accuracy(text[]) to authenticated;

create or replace function public.question_community_accuracy(p_question_ids text[])
returns table (
  question_id text,
  total_answers bigint,
  correct_answers bigint,
  accuracy integer
)
language sql
stable
set search_path = ''
as $$
  select * from private.question_community_accuracy(p_question_ids);
$$;

revoke all on function public.question_community_accuracy(text[]) from public;
grant execute on function public.question_community_accuracy(text[]) to authenticated;
