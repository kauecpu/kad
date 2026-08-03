-- Public usernames are intentionally discoverable, but the lookup no longer
-- needs a SECURITY DEFINER function that bypasses row-level security.
revoke all on function public.is_username_available(text) from public, anon, authenticated;

drop policy if exists "profiles_username_public_lookup" on public.profiles;
create policy "profiles_username_public_lookup"
on public.profiles for select
to anon
using (true);

revoke select on public.profiles from anon;
grant select (username) on public.profiles to anon;

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security invoker
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

revoke all on function public.is_username_available(text) from public, anon, authenticated;
grant execute on function public.is_username_available(text) to anon;
