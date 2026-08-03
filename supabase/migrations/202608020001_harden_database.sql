-- Keep Supabase's automatic RLS event trigger, but prevent clients from
-- attempting to invoke its SECURITY DEFINER helper directly.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- Index foreign-key columns used when an auth user is deleted.
create index if not exists question_comments_user_id_idx
on public.question_comments (user_id);

create index if not exists comment_likes_user_id_idx
on public.comment_likes (user_id);
