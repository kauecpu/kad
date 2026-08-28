begin;

alter table public.questions
  add column if not exists editorial_approved_at timestamptz,
  add column if not exists editorial_approved_by uuid references auth.users (id) on delete set null,
  add column if not exists published_by uuid references auth.users (id) on delete set null,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by uuid references auth.users (id) on delete set null;

create index if not exists questions_editorial_approved_by_idx
on public.questions (editorial_approved_by)
where editorial_approved_by is not null;

create index if not exists questions_published_by_idx
on public.questions (published_by)
where published_by is not null;

create table if not exists private.question_answer_evidence (
  question_id text primary key references public.questions (id) on delete cascade,
  evidence_status text not null check (
    evidence_status in ('official_matched', 'missing', 'conflict')
  ),
  official_answer text check (official_answer is null or official_answer in ('A', 'B', 'C', 'D', 'E')),
  evidence jsonb not null default '{}'::jsonb,
  import_batch_id uuid references private.editorial_import_batches (id) on delete set null,
  captured_at timestamptz not null default timezone('utc', now())
);

create table if not exists private.question_publication_events (
  id bigint generated always as identity primary key,
  question_id text not null references public.questions (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (
    action in ('approved', 'approval_invalidated', 'published', 'withdrawn')
  ),
  previous_status text not null,
  next_status text not null,
  preview_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists question_publication_events_question_idx
on private.question_publication_events (question_id, created_at desc);

create index if not exists question_publication_events_actor_idx
on private.question_publication_events (actor_id)
where actor_id is not null;

alter table private.question_answer_evidence enable row level security;
alter table private.question_publication_events enable row level security;
revoke all on table private.question_answer_evidence from public, anon, authenticated;
revoke all on table private.question_publication_events from public, anon, authenticated;

create or replace function private.capture_question_answer_evidence(
  p_question_id text,
  p_payload jsonb,
  p_batch_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correct text := nullif(trim(p_payload->'data'->>'correct'), '');
  v_provenances jsonb := p_payload->'data'->'canonicalQuestion'->'provenances';
  v_evidence_status text := 'missing';
begin
  if p_question_id is null or not exists (
    select 1 from public.questions where id = p_question_id
  ) then
    return;
  end if;

  if jsonb_typeof(v_provenances) = 'array'
    and jsonb_array_length(v_provenances) > 0
  then
    if not exists (
      select 1
      from jsonb_array_elements(v_provenances) as provenance
      where nullif(trim(provenance->>'answerKeyLinkId'), '') is null
        or provenance->>'answerStatus' <> 'matched'
        or provenance->>'answer' is distinct from v_correct
    ) then
      v_evidence_status := 'official_matched';
    else
      v_evidence_status := 'conflict';
    end if;
  end if;

  insert into private.question_answer_evidence (
    question_id, evidence_status, official_answer, evidence, import_batch_id, captured_at
  ) values (
    p_question_id,
    v_evidence_status,
    case when v_correct in ('A', 'B', 'C', 'D', 'E') then v_correct else null end,
    jsonb_strip_nulls(jsonb_build_object(
      'canonicalQuestion', p_payload->'data'->'canonicalQuestion',
      'source', p_payload->'source'
    )),
    p_batch_id,
    timezone('utc', now())
  )
  on conflict (question_id) do update set
    evidence_status = excluded.evidence_status,
    official_answer = excluded.official_answer,
    evidence = excluded.evidence,
    import_batch_id = excluded.import_batch_id,
    captured_at = excluded.captured_at;
end;
$$;

revoke all on function private.capture_question_answer_evidence(text, jsonb, uuid) from public;

create or replace function private.capture_imported_question_answer_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'question' and new.status = 'imported'
    and (tg_op = 'INSERT' or old.status is distinct from new.status)
  then
    perform private.capture_question_answer_evidence(
      new.resource_id,
      new.payload,
      new.batch_id
    );
  end if;
  return new;
end;
$$;

revoke all on function private.capture_imported_question_answer_evidence() from public;

drop trigger if exists capture_imported_question_answer_evidence
on private.editorial_import_items;
create trigger capture_imported_question_answer_evidence
after insert or update of status on private.editorial_import_items
for each row execute function private.capture_imported_question_answer_evidence();

do $$
declare
  item record;
begin
  for item in
    select distinct on (import_item.resource_id)
      import_item.resource_id,
      import_item.payload,
      import_item.batch_id
    from private.editorial_import_items as import_item
    where import_item.kind = 'question'
      and import_item.status = 'imported'
      and import_item.resource_id is not null
    order by import_item.resource_id, import_item.imported_at desc nulls last
  loop
    perform private.capture_question_answer_evidence(
      item.resource_id,
      item.payload,
      item.batch_id
    );
  end loop;
end;
$$;

create or replace function private.question_editorial_content_fingerprint(p_question_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'discipline', question.discipline,
    'subject', question.subject,
    'topic', question.topic,
    'board', question.board,
    'year', question.year,
    'role', question.role,
    'institution', question.institution,
    'concurso', question.concurso,
    'level', question.level,
    'difficulty', question.difficulty,
    'statement', question.statement,
    'alternatives', question.alternatives,
    'correct', question.correct,
    'sourceProvider', question.source_provider,
    'sourceExternalId', question.source_external_id,
    'sourceUrl', question.source_url,
    'sourceCollectedAt', question.source_collected_at,
    'sourceFingerprint', question.source_fingerprint
  )::text)
  from public.questions as question
  where question.id = p_question_id;
$$;

revoke all on function private.question_editorial_content_fingerprint(text) from public;

create or replace function private.question_publication_blockers(p_question_id text)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  question public.questions%rowtype;
  blockers text[] := array[]::text[];
begin
  select * into question from public.questions where id = p_question_id;
  if not found then
    return array['Questão não encontrada.'];
  end if;

  if char_length(trim(question.statement)) < 10 then
    blockers := array_append(blockers, 'Enunciado incompleto.');
  end if;
  if nullif(trim(question.discipline), '') is null
    or nullif(trim(question.subject), '') is null
    or nullif(trim(question.topic), '') is null
    or nullif(trim(question.level), '') is null
  then
    blockers := array_append(blockers, 'Classificação incompleta.');
  end if;
  if jsonb_typeof(question.alternatives) <> 'array'
    or jsonb_array_length(question.alternatives) not between 2 and 5
    or exists (
      select 1 from jsonb_array_elements(question.alternatives) as alternative
      where alternative->>'id' not in ('A', 'B', 'C', 'D', 'E')
        or nullif(trim(alternative->>'text'), '') is null
    )
    or (
      select count(distinct alternative->>'id')
      from jsonb_array_elements(question.alternatives) as alternative
    ) <> jsonb_array_length(question.alternatives)
    or not exists (
      select 1 from jsonb_array_elements(question.alternatives) as alternative
      where alternative->>'id' = question.correct
        and nullif(trim(alternative->>'text'), '') is not null
    )
  then
    blockers := array_append(blockers, 'Alternativas ou resposta inválidas.');
  end if;
  if nullif(trim(question.source_provider), '') is null
    or nullif(trim(question.source_external_id), '') is null
    or nullif(trim(question.source_url), '') is null
    or question.source_collected_at is null
    or nullif(trim(question.source_fingerprint), '') is null
  then
    blockers := array_append(blockers, 'Origem incompleta.');
  end if;
  if not exists (
    select 1
    from private.question_answer_evidence as evidence
    where evidence.question_id = question.id
      and evidence.evidence_status = 'official_matched'
      and evidence.official_answer = question.correct
  ) then
    blockers := array_append(blockers, 'Resposta oficial sem evidência compatível.');
  end if;
  if exists (
    select 1 from public.questions as duplicate
    where duplicate.id <> question.id
      and duplicate.source_provider = question.source_provider
      and duplicate.source_external_id = question.source_external_id
  ) then
    blockers := array_append(blockers, 'Origem duplicada em outra questão.');
  end if;

  return blockers;
end;
$$;

revoke all on function private.question_publication_blockers(text) from public;

create or replace function private.assert_expected_project_ref(p_expected_project_ref text)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_issuer text := coalesce(auth.jwt()->>'iss', '');
begin
  if p_expected_project_ref is null
    or p_expected_project_ref !~ '^[a-z0-9]{20}$'
    or v_issuer <> format('https://%s.supabase.co/auth/v1', p_expected_project_ref)
  then
    raise exception 'Environment mismatch' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_expected_project_ref(text) from public;

create or replace function private.question_publication_preview(
  p_question_ids text[],
  p_action text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with requested as (
    select distinct id
    from unnest(coalesce(p_question_ids, array[]::text[])) as id
    where nullif(trim(id), '') is not null
  ), evaluated as (
    select
      requested.id,
      question.publication_status as current_status,
      case p_action
        when 'approve' then 'review'
        when 'publish' then 'published'
        when 'withdraw' then 'archived'
      end as target_status,
      case
        when question.id is null then array['Questão não encontrada.']::text[]
        when p_action = 'approve' and question.publication_status not in ('draft', 'archived')
          then array['A questão precisa estar em rascunho ou arquivada para aprovação.']::text[]
        when p_action = 'publish' and (
          question.publication_status <> 'review' or question.editorial_approved_at is null
        ) then array['A questão precisa estar aprovada antes da publicação.']::text[]
        when p_action = 'withdraw' and question.publication_status <> 'published'
          then array['Somente questões publicadas podem ser retiradas.']::text[]
        when p_action in ('approve', 'publish')
          then private.question_publication_blockers(requested.id)
        else array[]::text[]
      end as blockers,
      question.updated_at
    from requested
    left join public.questions as question on question.id = requested.id
  ), payload as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', evaluated.id,
      'currentStatus', evaluated.current_status,
      'targetStatus', evaluated.target_status,
      'blockers', to_jsonb(evaluated.blockers),
      'canApply', cardinality(evaluated.blockers) = 0
    ) order by evaluated.id), '[]'::jsonb) as items,
    count(*)::integer as requested_count,
    count(*) filter (where cardinality(evaluated.blockers) = 0)::integer as eligible_count,
    count(*) filter (where cardinality(evaluated.blockers) > 0)::integer as blocked_count,
    md5(coalesce(string_agg(
      concat_ws('|', evaluated.id, evaluated.current_status, evaluated.target_status,
        evaluated.updated_at, array_to_string(evaluated.blockers, ',')),
      '||' order by evaluated.id
    ), '') || '|' || coalesce(p_action, '')) as fingerprint
    from evaluated
  )
  select jsonb_build_object(
    'action', p_action,
    'requestedCount', requested_count,
    'eligibleCount', eligible_count,
    'blockedCount', blocked_count,
    'previewFingerprint', fingerprint,
    'items', items
  )
  from payload;
$$;

revoke all on function private.question_publication_preview(text[], text) from public;

create or replace function public.admin_preview_question_publication(
  p_question_ids text[],
  p_action text,
  p_expected_project_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_admin_permission('content.read') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;
  perform private.assert_expected_project_ref(p_expected_project_ref);
  if p_action not in ('approve', 'publish', 'withdraw') then
    raise exception 'Invalid publication action' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_question_ids), 0) not between 1 and 500 then
    raise exception 'Select between one and 500 questions' using errcode = '22023';
  end if;
  return private.question_publication_preview(p_question_ids, p_action);
end;
$$;

create or replace function public.admin_apply_question_publication(
  p_question_ids text[],
  p_action text,
  p_expected_project_ref text,
  p_preview_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preview jsonb;
  v_item jsonb;
  v_question public.questions%rowtype;
  v_applied integer := 0;
  v_blocked integer := 0;
  v_now timestamptz := timezone('utc', now());
begin
  if p_action = 'approve' then
    if not private.has_admin_permission('content.write') then
      raise exception 'Admin permission required' using errcode = '42501';
    end if;
  elsif not private.has_admin_permission('content.publish') then
    raise exception 'Publish permission required' using errcode = '42501';
  end if;

  perform private.assert_expected_project_ref(p_expected_project_ref);
  if p_action not in ('approve', 'publish', 'withdraw') then
    raise exception 'Invalid publication action' using errcode = '22023';
  end if;

  -- Lock requested rows in a deterministic order before building the preview.
  -- This prevents a concurrent edit from making the confirmation stale between
  -- the preview and the update.
  perform 1
  from public.questions
  where id = any(coalesce(p_question_ids, array[]::text[]))
  order by id
  for update;

  v_preview := private.question_publication_preview(p_question_ids, p_action);
  if v_preview->>'previewFingerprint' is distinct from p_preview_fingerprint then
    raise exception 'Publication preview is stale' using errcode = '40001';
  end if;

  for v_item in select value from jsonb_array_elements(v_preview->'items')
  loop
    if not coalesce((v_item->>'canApply')::boolean, false) then
      v_blocked := v_blocked + 1;
      continue;
    end if;

    select * into v_question
    from public.questions
    where id = v_item->>'id'
    for update;

    if p_action = 'approve' then
      update public.questions
      set publication_status = 'review',
          editorial_approved_at = v_now,
          editorial_approved_by = auth.uid(),
          published_at = null,
          published_by = null,
          withdrawn_at = null,
          withdrawn_by = null,
          updated_at = v_now,
          updated_by = auth.uid()
      where id = v_question.id;
    elsif p_action = 'publish' then
      update public.questions
      set publication_status = 'published',
          published_at = v_now,
          published_by = auth.uid(),
          withdrawn_at = null,
          withdrawn_by = null,
          updated_at = v_now,
          updated_by = auth.uid()
      where id = v_question.id;
    else
      update public.questions
      set publication_status = 'archived',
          published_at = null,
          withdrawn_at = v_now,
          withdrawn_by = auth.uid(),
          updated_at = v_now,
          updated_by = auth.uid()
      where id = v_question.id;
    end if;

    insert into private.question_publication_events (
      question_id, actor_id, action, previous_status, next_status,
      preview_fingerprint, metadata
    ) values (
      v_question.id,
      auth.uid(),
      case p_action when 'approve' then 'approved' when 'publish' then 'published' else 'withdrawn' end,
      v_question.publication_status,
      v_item->>'targetStatus',
      p_preview_fingerprint,
      jsonb_build_object(
        'content_fingerprint', private.question_editorial_content_fingerprint(v_question.id)
      )
    );
    v_applied := v_applied + 1;
  end loop;

  insert into private.admin_audit_logs (
    actor_id, action, resource_type, metadata
  ) values (
    auth.uid(),
    'question.bulk_' || p_action,
    'question_batch',
    jsonb_build_object(
      'requested', (v_preview->>'requestedCount')::integer,
      'applied', v_applied,
      'blocked', v_blocked,
      'preview_fingerprint', p_preview_fingerprint,
      'question_ids', p_question_ids
    )
  );

  return jsonb_build_object(
    'action', p_action,
    'appliedCount', v_applied,
    'blockedCount', v_blocked
  );
end;
$$;

alter function public.admin_save_question(jsonb)
  rename to admin_save_question_before_controlled_publication;

create or replace function public.admin_save_question(p_question jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := trim(p_question->>'id');
  v_existing public.questions%rowtype;
  v_before_fingerprint text;
  v_after_fingerprint text;
  v_result jsonb;
begin
  if not private.has_admin_permission('content.write') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select * into v_existing from public.questions where id = v_id for update;
  if found and v_existing.publication_status = 'published' then
    raise exception 'Withdraw the published question before editing' using errcode = '55000';
  end if;

  v_before_fingerprint := private.question_editorial_content_fingerprint(v_id);
  v_result := public.admin_save_question_before_controlled_publication(
    (p_question - 'publicationStatus' - 'publishedAt')
    || jsonb_build_object(
      'publicationStatus', coalesce(v_existing.publication_status, 'draft'),
      'publishedAt', null
    )
  );
  v_after_fingerprint := private.question_editorial_content_fingerprint(v_id);

  if v_existing.editorial_approved_at is not null
    and v_before_fingerprint is distinct from v_after_fingerprint
  then
    update public.questions
    set publication_status = 'draft',
        editorial_approved_at = null,
        editorial_approved_by = null,
        updated_at = timezone('utc', now()),
        updated_by = auth.uid()
    where id = v_id;

    insert into private.question_publication_events (
      question_id, actor_id, action, previous_status, next_status, metadata
    ) values (
      v_id,
      auth.uid(),
      'approval_invalidated',
      v_existing.publication_status,
      'draft',
      jsonb_build_object(
        'previous_content_fingerprint', v_before_fingerprint,
        'current_content_fingerprint', v_after_fingerprint
      )
    );
    v_result := jsonb_set(v_result, '{publicationStatus}', '"draft"'::jsonb, true);
  end if;

  return v_result;
end;
$$;

create or replace function public.admin_list_questions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.has_admin_permission('content.read') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item order by item->>'updatedAt' desc), '[]'::jsonb)
  into result
  from (
    select jsonb_strip_nulls(jsonb_build_object(
      'id', question.id,
      'discipline', question.discipline,
      'subject', question.subject,
      'topic', question.topic,
      'board', question.board,
      'year', question.year,
      'role', question.role,
      'institution', question.institution,
      'concurso', question.concurso,
      'level', question.level,
      'difficulty', question.difficulty,
      'statement', question.statement,
      'alternatives', question.alternatives,
      'correct', question.correct,
      'explanation', question.explanation,
      'explanationOrigin', question.explanation_origin,
      'explanationReviewStatus', question.explanation_review_status,
      'explanationProvider', question.explanation_provider,
      'explanationModel', question.explanation_model,
      'explanationPromptVersion', question.explanation_prompt_version,
      'publicationStatus', question.publication_status,
      'editorialApprovedAt', question.editorial_approved_at,
      'editorialApprovedBy', question.editorial_approved_by,
      'publishedAt', question.published_at,
      'publishedBy', question.published_by,
      'withdrawnAt', question.withdrawn_at,
      'withdrawnBy', question.withdrawn_by,
      'publicationBlockers', to_jsonb(private.question_publication_blockers(question.id)),
      'hasOfficialAnswerEvidence', exists (
        select 1 from private.question_answer_evidence as evidence
        where evidence.question_id = question.id
          and evidence.evidence_status = 'official_matched'
          and evidence.official_answer = question.correct
      ),
      'sourceProvider', question.source_provider,
      'sourceExternalId', question.source_external_id,
      'sourceUrl', question.source_url,
      'sourceCollectedAt', question.source_collected_at,
      'importBatchId', question.import_batch_id,
      'updatedAt', question.updated_at
    )) as item
    from public.questions as question
  ) as items;

  return result;
end;
$$;

revoke all on function public.admin_save_question_before_controlled_publication(jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_save_question(jsonb) from public, anon;
revoke all on function public.admin_list_questions() from public, anon;
revoke all on function public.admin_preview_question_publication(text[], text, text)
  from public, anon;
revoke all on function public.admin_apply_question_publication(text[], text, text, text)
  from public, anon;

grant execute on function public.admin_save_question(jsonb) to authenticated;
grant execute on function public.admin_list_questions() to authenticated;
grant execute on function public.admin_preview_question_publication(text[], text, text)
  to authenticated;
grant execute on function public.admin_apply_question_publication(text[], text, text, text)
  to authenticated;

comment on table private.question_answer_evidence is
  'Collector evidence proving that a question answer came from a compatible official answer key.';
comment on table private.question_publication_events is
  'Append-only history for approval, publication, withdrawal, and invalidated approvals.';

commit;
