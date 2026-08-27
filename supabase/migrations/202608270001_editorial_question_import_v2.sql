begin;

alter table public.questions
  alter column explanation drop not null;

alter table public.questions
  alter column difficulty drop not null;

alter table public.questions
  drop constraint if exists questions_difficulty_check;

alter table public.questions
  add constraint questions_difficulty_check
  check (difficulty is null or difficulty in ('Fácil', 'Média', 'Difícil'));

alter table public.questions
  drop constraint if exists questions_explanation_check;

alter table public.questions
  add constraint questions_explanation_check
  check (explanation is null or char_length(explanation) between 10 and 12000);

alter table public.questions
  add column if not exists explanation_origin text,
  add column if not exists explanation_review_status text,
  add column if not exists explanation_provider text,
  add column if not exists explanation_model text,
  add column if not exists explanation_prompt_version text;

alter table public.questions
  drop constraint if exists questions_explanation_origin_check,
  drop constraint if exists questions_explanation_review_status_check;

alter table public.questions
  add constraint questions_explanation_origin_check
    check (explanation_origin is null or explanation_origin in ('official', 'editorial', 'ai')),
  add constraint questions_explanation_review_status_check
    check (
      explanation_review_status is null
      or explanation_review_status in ('draft', 'reviewed')
    );

create or replace function private.question_editorial_snapshot(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
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
    'explanation', case when question.explanation is null then null else
      jsonb_strip_nulls(jsonb_build_object(
        'text', question.explanation,
        'origin', question.explanation_origin,
        'reviewStatus', question.explanation_review_status,
        'provider', question.explanation_provider,
        'model', question.explanation_model,
        'promptVersion', question.explanation_prompt_version
      ))
    end,
    'publicationStatus', question.publication_status,
    'publishedAt', question.published_at,
    'sourceProvider', question.source_provider,
    'sourceExternalId', question.source_external_id,
    'sourceUrl', question.source_url,
    'sourceCollectedAt', question.source_collected_at,
    'sourceFingerprint', question.source_fingerprint,
    'importBatchId', question.import_batch_id,
    'updatedAt', question.updated_at
  )
  from public.questions as question
  where question.id = p_id;
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
      'publishedAt', question.published_at,
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


alter function private.editorial_import_record_errors(jsonb)
  rename to editorial_import_record_errors_v1;

create or replace function private.editorial_import_record_errors(p_record jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version text := p_record->>'schemaVersion';
  v_data jsonb := p_record->'data';
  v_explanation jsonb := v_data->'explanation';
  v_normalized jsonb;
  v_errors text[] := array[]::text[];
begin
  if v_version = '1' then
    return private.editorial_import_record_errors_v1(p_record);
  end if;

  if v_version <> '2' then
    return array['schemaVersion deve ser 1 ou 2.'];
  end if;

  if p_record->>'kind' <> 'question' then
    v_errors := array_append(v_errors, 'O contrato v2 aceita somente questões.');
  end if;

  if v_explanation is not null and jsonb_typeof(v_explanation) <> 'null' then
    if jsonb_typeof(v_explanation) <> 'object' then
      v_errors := array_append(v_errors, 'data.explanation deve ser um objeto no contrato v2.');
    else
      if coalesce(char_length(trim(v_explanation->>'text')), 0) < 10 then
        v_errors := array_append(v_errors, 'data.explanation.text deve ter ao menos 10 caracteres.');
      end if;
      if coalesce(v_explanation->>'origin', '') not in ('official', 'editorial', 'ai') then
        v_errors := array_append(v_errors, 'data.explanation.origin é inválida.');
      end if;
      if coalesce(v_explanation->>'reviewStatus', '') not in ('draft', 'reviewed') then
        v_errors := array_append(v_errors, 'data.explanation.reviewStatus é inválido.');
      end if;
      if v_explanation->>'origin' = 'ai' and (
        coalesce(char_length(trim(v_explanation->>'provider')), 0) = 0
        or coalesce(char_length(trim(v_explanation->>'model')), 0) = 0
        or coalesce(char_length(trim(v_explanation->>'promptVersion')), 0) = 0
      ) then
        v_errors := array_append(
          v_errors,
          'Explicação de IA exige provider, model e promptVersion.'
        );
      end if;
    end if;
  end if;

  v_normalized := jsonb_set(p_record, '{schemaVersion}', '1'::jsonb, true);
  if coalesce(char_length(trim(v_data->>'difficulty')), 0) = 0 then
    v_normalized := jsonb_set(
      v_normalized,
      '{data,difficulty}',
      to_jsonb('Média'::text),
      true
    );
  end if;
  v_normalized := jsonb_set(
    v_normalized,
    '{data,explanation}',
    to_jsonb(
      case
        when jsonb_typeof(v_explanation) = 'object'
          then coalesce(v_explanation->>'text', 'explicação inválida')
        else 'Questão sem explicação no contrato v2.'
      end
    ),
    true
  );
  v_errors := v_errors || private.editorial_import_record_errors_v1(v_normalized);
  return v_errors;
end;
$$;

revoke all on function private.editorial_import_record_errors(jsonb) from public;

create or replace function public.admin_create_import_batch(
  p_filename text,
  p_records jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_record jsonb;
  v_position bigint;
  v_kind text;
  v_resource_id text;
  v_provider text;
  v_external_id text;
  v_source_url text;
  v_source_key text;
  v_errors text[];
  v_status text;
  v_decision text;
  v_duplicate boolean;
  v_item_count integer := 0;
  v_ready_count integer := 0;
  v_duplicate_count integer := 0;
  v_invalid_count integer := 0;
begin
  if not private.has_admin_permission('content.write') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_records, 'null'::jsonb)) <> 'array'
    or jsonb_array_length(p_records) not between 1 and 5000 then
    raise exception 'Import batches must contain between one and 5000 records'
      using errcode = '22023';
  end if;

  insert into private.editorial_import_batches (filename, created_by)
  values (trim(p_filename), auth.uid())
  returning id into v_batch_id;

  for v_record, v_position in
    select value, ordinality
    from jsonb_array_elements(p_records) with ordinality
  loop
    v_item_count := v_item_count + 1;
    v_kind := nullif(trim(v_record->>'kind'), '');
    v_resource_id := trim(v_record->'data'->>'id');
    v_provider := trim(v_record->'source'->>'provider');
    v_external_id := trim(v_record->'source'->>'externalId');
    v_source_url := trim(v_record->'source'->>'url');
    v_source_key := concat_ws(':', v_kind, v_provider, v_external_id);
    v_errors := private.editorial_import_record_errors(v_record);

    if exists (
      select 1 from private.editorial_import_items
      where batch_id = v_batch_id and source_key = v_source_key
    ) then
      v_errors := array_append(v_errors, 'Registro duplicado dentro do mesmo lote.');
    end if;

    v_duplicate := case v_kind
      when 'concurso' then exists (
        select 1 from public.concursos
        where id = v_resource_id
          or (source_provider = v_provider and source_external_id = v_external_id)
      )
      when 'question' then exists (
        select 1 from public.questions
        where id = v_resource_id
          or (source_provider = v_provider and source_external_id = v_external_id)
      )
      else false
    end;

    if cardinality(v_errors) > 0 then
      v_status := 'invalid';
      v_decision := 'skip';
      v_invalid_count := v_invalid_count + 1;
    elsif v_duplicate then
      v_status := 'duplicate';
      v_decision := 'skip';
      v_duplicate_count := v_duplicate_count + 1;
    else
      v_status := 'ready';
      v_decision := 'import';
      v_ready_count := v_ready_count + 1;
    end if;

    insert into private.editorial_import_items (
      batch_id, position, kind, resource_id, source_key, source_url,
      payload, status, decision, errors
    ) values (
      v_batch_id, v_position::integer, v_kind, v_resource_id, v_source_key, v_source_url,
      v_record, v_status, v_decision, to_jsonb(v_errors)
    );
  end loop;

  update private.editorial_import_batches
  set item_count = v_item_count,
      ready_count = v_ready_count,
      duplicate_count = v_duplicate_count,
      invalid_count = v_invalid_count
  where id = v_batch_id;

  insert into private.admin_audit_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    auth.uid(),
    'import.created',
    'editorial_import_batch',
    v_batch_id::text,
    jsonb_build_object(
      'filename', trim(p_filename),
      'item_count', v_item_count,
      'ready_count', v_ready_count,
      'duplicate_count', v_duplicate_count,
      'invalid_count', v_invalid_count
    )
  );

  return v_batch_id;
end;
$$;

alter function public.admin_save_question(jsonb)
  rename to admin_save_question_v1;

create or replace function public.admin_save_question(p_question jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := trim(p_question->>'id');
  v_explanation jsonb := p_question->'explanation';
  v_has_explanation boolean := (
    v_explanation is not null and jsonb_typeof(v_explanation) <> 'null'
  );
  v_text text;
  v_origin text;
  v_review_status text;
  v_provider text;
  v_model text;
  v_prompt_version text;
  v_result jsonb;
begin
  if coalesce(nullif(trim(p_question->>'publicationStatus'), ''), 'draft') = 'published'
    and nullif(trim(p_question->>'difficulty'), '') is null then
    raise exception 'Difficulty is required before publication' using errcode = '22023';
  end if;

  if jsonb_typeof(v_explanation) = 'object' then
    v_text := nullif(trim(v_explanation->>'text'), '');
    v_origin := nullif(trim(v_explanation->>'origin'), '');
    v_review_status := nullif(trim(v_explanation->>'reviewStatus'), '');
    v_provider := nullif(trim(v_explanation->>'provider'), '');
    v_model := nullif(trim(v_explanation->>'model'), '');
    v_prompt_version := nullif(trim(v_explanation->>'promptVersion'), '');
  elsif jsonb_typeof(v_explanation) = 'string' then
    v_text := nullif(trim(p_question->>'explanation'), '');
    v_origin := coalesce(nullif(trim(p_question->>'explanationOrigin'), ''), 'editorial');
    v_review_status := coalesce(
      nullif(trim(p_question->>'explanationReviewStatus'), ''),
      'reviewed'
    );
    v_provider := nullif(trim(p_question->>'explanationProvider'), '');
    v_model := nullif(trim(p_question->>'explanationModel'), '');
    v_prompt_version := nullif(trim(p_question->>'explanationPromptVersion'), '');
  else
    select explanation, explanation_origin, explanation_review_status,
      explanation_provider, explanation_model, explanation_prompt_version
    into v_text, v_origin, v_review_status, v_provider, v_model, v_prompt_version
    from public.questions
    where id = v_id;
  end if;

  v_result := public.admin_save_question_v1(
    (p_question - 'explanation')
    || jsonb_build_object('explanation', v_text)
  );

  if v_has_explanation then
    update public.questions
    set explanation_origin = v_origin,
        explanation_review_status = v_review_status,
        explanation_provider = v_provider,
        explanation_model = v_model,
        explanation_prompt_version = v_prompt_version
    where id = v_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.admin_save_question(jsonb) from public, anon;
grant execute on function public.admin_save_question(jsonb) to authenticated;

comment on column public.questions.explanation is
  'Optional commented answer. Reimports without it preserve the existing value.';
comment on column public.questions.explanation_origin is
  'Origin declared by contract v2: official, editorial or ai.';

commit;
