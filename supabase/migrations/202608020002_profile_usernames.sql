alter table public.profiles add column if not exists username text;

update public.profiles
set username = 'user_' || replace(left(id::text, 8), '-', '')
where username is null or trim(username) = '';

alter table public.profiles alter column username set not null;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
check (username = lower(username) and username ~ '^[a-z0-9_]{3,24}$');

create unique index if not exists profiles_username_lower_unique
on public.profiles ((lower(username)));

comment on column public.profiles.username is
'Identificador público único e estável. O UUID em profiles.id continua sendo a chave primária.';

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    lower(trim(candidate_username)) ~ '^[a-z0-9_]{3,24}$'
    and not exists (
      select 1
      from public.profiles as profile
      where profile.username = lower(trim(candidate_username))
    ),
    false
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := lower(trim(new.raw_user_meta_data ->> 'username'));
  safe_username text;
begin
  safe_username := case
    when requested_username ~ '^[a-z0-9_]{3,24}$' then requested_username
    else 'user_' || replace(left(new.id::text, 8), '-', '')
  end;

  insert into public.profiles (id, name, username)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(split_part(new.email, '@', 1), ''),
        'Estudante'
      ),
      120
    ),
    safe_username
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
