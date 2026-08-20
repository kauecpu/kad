drop policy if exists "question_attempts_insert_own" on public.question_attempts;
drop policy if exists "question_attempts_update_own" on public.question_attempts;

revoke insert, update on public.question_attempts from authenticated;
revoke insert, update on public.question_attempts from anon;
revoke insert, update on public.question_attempts from public;

create or replace function public.record_question_attempt(p_question_id text, p_selected text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  question public.questions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_selected is null or p_selected not in ('A', 'B', 'C', 'D', 'E') then
    raise exception 'Invalid selected alternative' using errcode = '22023';
  end if;

  select *
  into question
  from public.questions
  where id = p_question_id
    and publication_status = 'published';

  if not found then
    raise exception 'Published question not found' using errcode = '22023';
  end if;

  insert into public.question_attempts (
    user_id,
    question_id,
    subject,
    selected,
    is_correct,
    answered_at
  )
  values (
    v_user_id,
    question.id,
    question.subject,
    p_selected,
    p_selected = question.correct,
    timezone('utc', now())
  )
  on conflict (user_id, question_id) do update
  set
    subject = excluded.subject,
    selected = excluded.selected,
    is_correct = excluded.is_correct,
    answered_at = excluded.answered_at;
end;
$$;

revoke all on function public.record_question_attempt(text, text) from public, anon, authenticated;
grant execute on function public.record_question_attempt(text, text) to authenticated;
