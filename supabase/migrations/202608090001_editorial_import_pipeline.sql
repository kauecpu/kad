create table if not exists private.editorial_import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null check (char_length(filename) between 1 and 240),
  status text not null default 'staging' check (
    status in ('staging', 'imported', 'import_partial', 'rolled_back', 'rollback_partial')
  ),
  item_count integer not null default 0 check (item_count >= 0),
  ready_count integer not null default 0 check (ready_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  invalid_count integer not null default 0 check (invalid_count >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  imported_at timestamptz,
  rolled_back_at timestamptz
);

create table if not exists private.editorial_import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references private.editorial_import_batches (id) on delete cascade,
  position integer not null check (position > 0),
  kind text,
  resource_id text,
  source_key text,
  source_url text,
  payload jsonb not null,
  status text not null check (
    status in (
      'ready', 'duplicate', 'invalid', 'imported', 'skipped', 'failed',
      'rolled_back', 'rollback_blocked'
    )
  ),
  decision text not null default 'import' check (decision in ('import', 'upsert', 'skip')),
  errors jsonb not null default '[]'::jsonb,
  previous_snapshot jsonb,
  imported_at timestamptz,
  unique (batch_id, position)
);

create index if not exists editorial_import_batches_created_idx
on private.editorial_import_batches (created_at desc);

create index if not exists editorial_import_items_batch_idx
on private.editorial_import_items (batch_id, position);

create index if not exists editorial_import_items_source_idx
on private.editorial_import_items (source_key);

alter table private.editorial_import_batches enable row level security;
alter table private.editorial_import_items enable row level security;
revoke all on table private.editorial_import_batches from public, anon, authenticated;
revoke all on table private.editorial_import_items from public, anon, authenticated;

alter table public.concursos
  add column if not exists source_provider text,
  add column if not exists source_external_id text,
  add column if not exists source_url text,
  add column if not exists source_collected_at timestamptz,
  add column if not exists source_fingerprint text,
  add column if not exists import_batch_id uuid;

create unique index if not exists concursos_source_identity_idx
on public.concursos (source_provider, source_external_id)
where source_provider is not null and source_external_id is not null;

create table if not exists public.questions (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,119}$'),
  discipline text not null check (char_length(discipline) between 2 and 120),
  subject text not null check (char_length(subject) between 2 and 160),
  topic text not null check (char_length(topic) between 2 and 180),
  board text not null check (char_length(board) between 2 and 100),
  year integer not null check (year between 1900 and 2200),
  role text not null check (char_length(role) between 2 and 180),
  institution text not null check (char_length(institution) between 2 and 180),
  concurso text not null check (char_length(concurso) between 2 and 220),
  level text not null check (level in ('Fundamental', 'Médio', 'Superior')),
  difficulty text not null check (difficulty in ('Fácil', 'Média', 'Difícil')),
  statement text not null check (char_length(statement) between 10 and 12000),
  alternatives jsonb not null check (
    jsonb_typeof(alternatives) = 'array'
    and jsonb_array_length(alternatives) between 2 and 5
  ),
  correct text not null check (correct in ('A', 'B', 'C', 'D', 'E')),
  explanation text not null check (char_length(explanation) between 10 and 12000),
  publication_status text not null default 'draft' check (
    publication_status in ('draft', 'review', 'published', 'archived')
  ),
  published_at timestamptz,
  source_provider text,
  source_external_id text,
  source_url text,
  source_collected_at timestamptz,
  source_fingerprint text,
  import_batch_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists questions_publication_status_idx
on public.questions (publication_status, updated_at desc);

create unique index if not exists questions_source_identity_idx
on public.questions (source_provider, source_external_id)
where source_provider is not null and source_external_id is not null;

alter table public.questions enable row level security;

drop policy if exists "questions_read_published" on public.questions;
create policy "questions_read_published"
on public.questions for select
to anon, authenticated
using (publication_status = 'published');

revoke all on table public.questions from public, anon, authenticated;
grant select on table public.questions to anon, authenticated;

create or replace function private.concurso_editorial_snapshot(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', concurso.id,
    'shortName', concurso.short_name,
    'icon', concurso.icon,
    'iconColor', concurso.icon_color,
    'organ', concurso.organ,
    'title', concurso.title,
    'board', concurso.board,
    'state', concurso.state,
    'city', concurso.city,
    'region', concurso.region,
    'levels', to_jsonb(concurso.levels),
    'vacancies', concurso.vacancies,
    'salaryMin', concurso.salary_min,
    'salaryMax', concurso.salary_max,
    'registrationStart', concurso.registration_start,
    'registrationEnd', concurso.registration_end,
    'examDate', concurso.exam_date,
    'fee', concurso.fee,
    'status', concurso.status,
    'highlights', to_jsonb(concurso.highlights),
    'editalUrl', concurso.edital_url,
    'publicationStatus', concurso.publication_status,
    'publishedAt', concurso.published_at,
    'sourceProvider', concurso.source_provider,
    'sourceExternalId', concurso.source_external_id,
    'sourceUrl', concurso.source_url,
    'sourceCollectedAt', concurso.source_collected_at,
    'sourceFingerprint', concurso.source_fingerprint,
    'importBatchId', concurso.import_batch_id,
    'roles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', role.name,
          'vacancies', role.vacancies,
          'salary', role.salary,
          'level', role.level
        ) order by role.sort_order, role.id
      )
      from public.concurso_roles as role
      where role.concurso_id = concurso.id
    ), '[]'::jsonb)
  )
  from public.concursos as concurso
  where concurso.id = p_id;
$$;

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
    'explanation', question.explanation,
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

revoke all on function private.concurso_editorial_snapshot(text) from public;
revoke all on function private.question_editorial_snapshot(text) from public;

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
      'explanation', question.explanation,
      'publicationStatus', question.publication_status,
      'publishedAt', question.published_at,
      'sourceProvider', question.source_provider,
      'sourceUrl', question.source_url,
      'updatedAt', question.updated_at
    ) as item
    from public.questions as question
  ) as items;

  return result;
end;
$$;

create or replace function public.admin_apply_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_status text;
  v_item record;
  v_data jsonb;
  v_source jsonb;
  v_previous jsonb;
  v_target_id text;
  v_imported integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
begin
  if not private.has_admin_permission('content.write') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select status into v_batch_status
  from private.editorial_import_batches
  where id = p_batch_id
  for update;

  if v_batch_status is null then
    raise exception 'Import batch not found' using errcode = 'P0002';
  end if;

  if v_batch_status <> 'staging' then
    raise exception 'Import batch has already been processed' using errcode = '55000';
  end if;

  for v_item in
    select *
    from private.editorial_import_items
    where batch_id = p_batch_id
    order by position
  loop
    if v_item.status = 'invalid' or v_item.decision = 'skip' then
      if v_item.status <> 'invalid' then
        update private.editorial_import_items set status = 'skipped' where id = v_item.id;
      end if;
      v_skipped := v_skipped + 1;
      continue;
    end if;

    begin
      v_data := v_item.payload->'data';
      v_source := v_item.payload->'source';
      v_target_id := v_item.resource_id;

      if v_item.decision = 'upsert' then
        if v_item.kind = 'concurso' then
          select id into v_target_id
          from public.concursos
          where id = v_item.resource_id
            or (source_provider = v_source->>'provider'
              and source_external_id = v_source->>'externalId')
          order by (id = v_item.resource_id) desc
          limit 1;
        else
          select id into v_target_id
          from public.questions
          where id = v_item.resource_id
            or (source_provider = v_source->>'provider'
              and source_external_id = v_source->>'externalId')
          order by (id = v_item.resource_id) desc
          limit 1;
        end if;
      end if;

      v_data := v_data || jsonb_build_object('id', v_target_id);

      if v_item.kind = 'concurso' then
        v_previous := private.concurso_editorial_snapshot(v_target_id);
        perform public.admin_save_concurso(
          v_data
          || jsonb_build_object(
            'publicationStatus', 'draft',
            'publishedAt', null
          )
        );

        update public.concursos
        set source_provider = nullif(trim(v_source->>'provider'), ''),
            source_external_id = nullif(trim(v_source->>'externalId'), ''),
            source_url = nullif(trim(v_source->>'url'), ''),
            source_collected_at = nullif(v_source->>'collectedAt', '')::timestamptz,
            source_fingerprint = nullif(trim(v_source->>'fingerprint'), ''),
            import_batch_id = p_batch_id,
            updated_at = timezone('utc', now())
        where id = v_target_id;
      else
        v_previous := private.question_editorial_snapshot(v_target_id);
        perform public.admin_save_question(
          v_data
          || jsonb_build_object(
            'publicationStatus', 'draft',
            'publishedAt', null,
            'sourceProvider', v_source->>'provider',
            'sourceExternalId', v_source->>'externalId',
            'sourceUrl', v_source->>'url',
            'sourceCollectedAt', v_source->>'collectedAt',
            'sourceFingerprint', v_source->>'fingerprint',
            'importBatchId', p_batch_id
          )
        );
      end if;

      update private.editorial_import_items
      set status = 'imported',
          resource_id = v_target_id,
          previous_snapshot = v_previous,
          imported_at = timezone('utc', now())
      where id = v_item.id;
      v_imported := v_imported + 1;
    exception when others then
      update private.editorial_import_items
      set status = 'failed',
          errors = jsonb_build_array('Falha ao importar o registro. Revise o conteúdo e tente em um novo lote.')
      where id = v_item.id;
      v_failed := v_failed + 1;
    end;
  end loop;

  update private.editorial_import_batches
  set status = case when v_failed = 0 then 'imported' else 'import_partial' end,
      imported_at = timezone('utc', now())
  where id = p_batch_id;

  insert into private.admin_audit_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    auth.uid(),
    'import.applied',
    'editorial_import_batch',
    p_batch_id::text,
    jsonb_build_object('imported', v_imported, 'skipped', v_skipped, 'failed', v_failed)
  );

  return jsonb_build_object('imported', v_imported, 'skipped', v_skipped, 'failed', v_failed);
end;
$$;

create or replace function public.admin_rollback_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_status text;
  v_item record;
  v_current_status text;
  v_current_batch uuid;
  v_current_updated_at timestamptz;
  v_rolled_back integer := 0;
  v_blocked integer := 0;
begin
  if not private.has_admin_permission('content.write') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select status into v_batch_status
  from private.editorial_import_batches
  where id = p_batch_id
  for update;

  if v_batch_status not in ('imported', 'import_partial') then
    raise exception 'Only imported batches can be rolled back' using errcode = '55000';
  end if;

  for v_item in
    select *
    from private.editorial_import_items
    where batch_id = p_batch_id and status = 'imported'
    order by position desc
  loop
    if v_item.kind = 'concurso' then
      select publication_status, import_batch_id, updated_at
      into v_current_status, v_current_batch, v_current_updated_at
      from public.concursos where id = v_item.resource_id;
    else
      select publication_status, import_batch_id, updated_at
      into v_current_status, v_current_batch, v_current_updated_at
      from public.questions where id = v_item.resource_id;
    end if;

    if v_current_status = 'published'
      or v_current_batch is distinct from p_batch_id
      or v_current_updated_at > v_item.imported_at then
      update private.editorial_import_items set status = 'rollback_blocked' where id = v_item.id;
      v_blocked := v_blocked + 1;
      continue;
    end if;

    if v_item.previous_snapshot is null then
      if v_item.kind = 'concurso' then
        delete from public.concursos where id = v_item.resource_id;
      else
        delete from public.questions where id = v_item.resource_id;
      end if;
    elsif v_item.kind = 'concurso' then
      perform public.admin_save_concurso(v_item.previous_snapshot);
      update public.concursos
      set source_provider = nullif(v_item.previous_snapshot->>'sourceProvider', ''),
          source_external_id = nullif(v_item.previous_snapshot->>'sourceExternalId', ''),
          source_url = nullif(v_item.previous_snapshot->>'sourceUrl', ''),
          source_collected_at = nullif(v_item.previous_snapshot->>'sourceCollectedAt', '')::timestamptz,
          source_fingerprint = nullif(v_item.previous_snapshot->>'sourceFingerprint', ''),
          import_batch_id = nullif(v_item.previous_snapshot->>'importBatchId', '')::uuid
      where id = v_item.resource_id;
    else
      perform public.admin_save_question(v_item.previous_snapshot);
      update public.questions
      set import_batch_id = nullif(v_item.previous_snapshot->>'importBatchId', '')::uuid
      where id = v_item.resource_id;
    end if;

    update private.editorial_import_items set status = 'rolled_back' where id = v_item.id;
    v_rolled_back := v_rolled_back + 1;
  end loop;

  update private.editorial_import_batches
  set status = case when v_blocked = 0 then 'rolled_back' else 'rollback_partial' end,
      rolled_back_at = timezone('utc', now())
  where id = p_batch_id;

  insert into private.admin_audit_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    auth.uid(),
    'import.rolled_back',
    'editorial_import_batch',
    p_batch_id::text,
    jsonb_build_object('rolled_back', v_rolled_back, 'blocked', v_blocked)
  );

  return jsonb_build_object('rolledBack', v_rolled_back, 'blocked', v_blocked);
end;
$$;

create or replace function private.editorial_import_record_errors(p_record jsonb)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_errors text[] := '{}'::text[];
  v_kind text;
  v_data jsonb;
  v_source jsonb;
  v_resource_id text;
  v_provider text;
  v_external_id text;
  v_source_url text;
  v_role jsonb;
begin
  if jsonb_typeof(coalesce(p_record, 'null'::jsonb)) <> 'object' then
    return array['O registro deve ser um objeto JSON.'];
  end if;

  v_kind := nullif(trim(p_record->>'kind'), '');
  v_data := p_record->'data';
  v_source := p_record->'source';
  v_resource_id := trim(v_data->>'id');
  v_provider := trim(v_source->>'provider');
  v_external_id := trim(v_source->>'externalId');
  v_source_url := trim(v_source->>'url');

  if coalesce(p_record->>'schemaVersion', '') <> '1' then
    v_errors := array_append(v_errors, 'schemaVersion deve ser 1.');
  end if;

  if coalesce(v_kind, '') not in ('concurso', 'question') then
    v_errors := array_append(v_errors, 'kind deve ser concurso ou question.');
  end if;

  if jsonb_typeof(coalesce(v_source, 'null'::jsonb)) <> 'object' then
    v_errors := array_append(v_errors, 'source é obrigatório.');
  else
    if coalesce(char_length(v_provider), 0) < 2 or coalesce(char_length(v_external_id), 0) < 1 then
      v_errors := array_append(v_errors, 'source.provider e source.externalId são obrigatórios.');
    end if;
    if coalesce(v_source_url, '') !~ '^https://' then
      v_errors := array_append(v_errors, 'source.url deve usar HTTPS.');
    end if;
    if nullif(v_source->>'collectedAt', '') is null then
      v_errors := array_append(v_errors, 'source.collectedAt é obrigatório.');
    else
      begin
        perform (v_source->>'collectedAt')::timestamptz;
      exception when others then
        v_errors := array_append(v_errors, 'source.collectedAt deve ser uma data ISO válida.');
      end;
    end if;
  end if;

  if jsonb_typeof(coalesce(v_data, 'null'::jsonb)) <> 'object' then
    v_errors := array_append(v_errors, 'data é obrigatório.');
    return v_errors;
  end if;

  if v_resource_id is null or v_resource_id !~ '^[a-z0-9][a-z0-9-]{2,119}$' then
    v_errors := array_append(v_errors, 'data.id possui formato inválido.');
  elsif v_kind = 'concurso' and char_length(v_resource_id) > 80 then
    v_errors := array_append(v_errors, 'data.id de concurso deve ter no máximo 80 caracteres.');
  end if;

  if v_kind = 'concurso' then
    if coalesce(char_length(trim(v_data->>'shortName')), 0) not between 2 and 40
      or coalesce(char_length(trim(v_data->>'organ')), 0) not between 3 and 180
      or coalesce(char_length(trim(v_data->>'title')), 0) not between 3 and 180
      or coalesce(char_length(trim(v_data->>'board')), 0) not between 2 and 80 then
      v_errors := array_append(v_errors, 'Concurso sem identificação válida.');
    end if;
    if coalesce(trim(v_data->>'iconColor'), '#6D28D9') !~ '^#[0-9A-Fa-f]{6}$' then
      v_errors := array_append(v_errors, 'data.iconColor deve ser uma cor hexadecimal.');
    end if;
    if coalesce(trim(v_data->>'region'), '') not in ('Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Nacional')
      or coalesce(char_length(trim(v_data->>'state')), 0) not between 2 and 30 then
      v_errors := array_append(v_errors, 'Região ou estado do concurso é inválido.');
    end if;
    if coalesce(trim(v_data->>'status'), '') not in ('aberto', 'previsto', 'encerrado') then
      v_errors := array_append(v_errors, 'Situação do edital é inválida.');
    end if;
    if coalesce(trim(v_data->>'editalUrl'), '') !~ '^https://' then
      v_errors := array_append(v_errors, 'data.editalUrl deve usar HTTPS.');
    end if;
    if coalesce(v_data->>'vacancies', '') !~ '^\d+$'
      or coalesce(v_data->>'salaryMin', '') !~ '^\d+(\.\d{1,2})?$'
      or coalesce(v_data->>'salaryMax', '') !~ '^\d+(\.\d{1,2})?$' then
      v_errors := array_append(v_errors, 'Vagas e faixas salariais devem ser números não negativos.');
    elsif (v_data->>'salaryMax')::numeric < (v_data->>'salaryMin')::numeric then
      v_errors := array_append(v_errors, 'data.salaryMax não pode ser menor que data.salaryMin.');
    end if;
    if nullif(v_data->>'fee', '') is not null
      and (v_data->>'fee') !~ '^\d+(\.\d{1,2})?$' then
      v_errors := array_append(v_errors, 'data.fee deve ser um número não negativo.');
    end if;
    if jsonb_typeof(coalesce(v_data->'highlights', '[]'::jsonb)) <> 'array' then
      v_errors := array_append(v_errors, 'data.highlights deve ser uma lista.');
    end if;
    if (nullif(v_data->>'registrationStart', '') is not null and (v_data->>'registrationStart') !~ '^\d{4}-\d{2}-\d{2}$')
      or (nullif(v_data->>'registrationEnd', '') is not null and (v_data->>'registrationEnd') !~ '^\d{4}-\d{2}-\d{2}$')
      or (nullif(v_data->>'examDate', '') is not null and (v_data->>'examDate') !~ '^\d{4}-\d{2}-\d{2}$') then
      v_errors := array_append(v_errors, 'Datas do concurso devem usar YYYY-MM-DD.');
    end if;
    if jsonb_typeof(coalesce(v_data->'levels', 'null'::jsonb)) <> 'array' then
      v_errors := array_append(v_errors, 'Concurso deve possuir ao menos um nível de escolaridade.');
    elsif jsonb_array_length(v_data->'levels') = 0 then
      v_errors := array_append(v_errors, 'Concurso deve possuir ao menos um nível de escolaridade.');
    elsif exists (
      select 1 from jsonb_array_elements_text(v_data->'levels') as level_value
      where level_value not in ('Fundamental', 'Médio', 'Superior')
    ) then
      v_errors := array_append(v_errors, 'Nível de escolaridade inválido.');
    end if;
    if jsonb_typeof(coalesce(v_data->'roles', 'null'::jsonb)) <> 'array' then
      v_errors := array_append(v_errors, 'Concurso deve possuir ao menos um cargo.');
    elsif jsonb_array_length(v_data->'roles') = 0 then
      v_errors := array_append(v_errors, 'Concurso deve possuir ao menos um cargo.');
    else
      for v_role in select value from jsonb_array_elements(v_data->'roles') loop
        if coalesce(char_length(trim(v_role->>'name')), 0) not between 3 and 180
          or coalesce(trim(v_role->>'level'), '') not in ('Fundamental', 'Médio', 'Superior')
          or coalesce(v_role->>'vacancies', '') !~ '^\d+$'
          or coalesce(v_role->>'salary', '') !~ '^\d+(\.\d{1,2})?$' then
          v_errors := array_append(v_errors, 'Cargo com nome, nível, vagas ou salário inválido.');
          exit;
        end if;
      end loop;
    end if;
  elsif v_kind = 'question' then
    if coalesce(char_length(trim(v_data->>'discipline')), 0) < 2
      or coalesce(char_length(trim(v_data->>'topic')), 0) < 2
      or coalesce(char_length(trim(v_data->>'statement')), 0) < 10
      or coalesce(char_length(trim(v_data->>'explanation')), 0) < 10 then
      v_errors := array_append(v_errors, 'Questão sem conteúdo mínimo.');
    end if;
    if jsonb_typeof(coalesce(v_data->'alternatives', 'null'::jsonb)) <> 'array' then
      v_errors := array_append(v_errors, 'Questão deve possuir entre duas e cinco alternativas.');
    elsif jsonb_array_length(v_data->'alternatives') not between 2 and 5 then
      v_errors := array_append(v_errors, 'Questão deve possuir entre duas e cinco alternativas.');
    end if;
    if coalesce(trim(v_data->>'correct'), '') not in ('A', 'B', 'C', 'D', 'E') then
      v_errors := array_append(v_errors, 'Gabarito inválido.');
    end if;
  end if;

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

  if jsonb_typeof(coalesce(p_records, 'null'::jsonb)) <> 'array' then
    raise exception 'Import batches must contain between one and 500 records'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_records) not between 1 and 500 then
    raise exception 'Import batches must contain between one and 500 records'
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

create or replace function public.admin_list_import_batches()
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', batch.id,
    'filename', batch.filename,
    'status', batch.status,
    'itemCount', batch.item_count,
    'readyCount', batch.ready_count,
    'duplicateCount', batch.duplicate_count,
    'invalidCount', batch.invalid_count,
    'createdAt', batch.created_at,
    'importedAt', batch.imported_at,
    'rolledBackAt', batch.rolled_back_at
  ) order by batch.created_at desc), '[]'::jsonb)
  into result
  from private.editorial_import_batches as batch;

  return result;
end;
$$;

create or replace function public.admin_get_import_batch(p_batch_id uuid)
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

  select jsonb_build_object(
    'id', batch.id,
    'filename', batch.filename,
    'status', batch.status,
    'itemCount', batch.item_count,
    'readyCount', batch.ready_count,
    'duplicateCount', batch.duplicate_count,
    'invalidCount', batch.invalid_count,
    'createdAt', batch.created_at,
    'importedAt', batch.imported_at,
    'rolledBackAt', batch.rolled_back_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'position', item.position,
        'kind', item.kind,
        'resourceId', item.resource_id,
        'sourceKey', item.source_key,
        'sourceUrl', item.source_url,
        'payload', item.payload,
        'status', item.status,
        'decision', item.decision,
        'errors', item.errors
      ) order by item.position)
      from private.editorial_import_items as item
      where item.batch_id = batch.id
    ), '[]'::jsonb)
  )
  into result
  from private.editorial_import_batches as batch
  where batch.id = p_batch_id;

  if result is null then
    raise exception 'Import batch not found' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

create or replace function public.admin_set_import_item_decision(
  p_item_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_batch_status text;
begin
  if not private.has_admin_permission('content.write') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select item.status, batch.status
  into v_status, v_batch_status
  from private.editorial_import_items as item
  join private.editorial_import_batches as batch on batch.id = item.batch_id
  where item.id = p_item_id;

  if v_batch_status <> 'staging' or v_status not in ('ready', 'duplicate') then
    raise exception 'Import decision can no longer be changed' using errcode = '55000';
  end if;

  if p_decision not in ('import', 'upsert', 'skip')
    or (v_status = 'ready' and p_decision = 'upsert')
    or (v_status = 'duplicate' and p_decision = 'import') then
    raise exception 'Invalid import decision' using errcode = '22023';
  end if;

  update private.editorial_import_items
  set decision = p_decision
  where id = p_item_id;
end;
$$;

create or replace function public.admin_update_import_item(
  p_item_id uuid,
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_batch_status text;
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
begin
  if not private.has_admin_permission('content.write') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select item.batch_id, batch.status
  into v_batch_id, v_batch_status
  from private.editorial_import_items as item
  join private.editorial_import_batches as batch on batch.id = item.batch_id
  where item.id = p_item_id
  for update of item, batch;

  if v_batch_id is null then
    raise exception 'Import item not found' using errcode = 'P0002';
  end if;

  if v_batch_status <> 'staging' then
    raise exception 'Import item can no longer be changed' using errcode = '55000';
  end if;

  v_kind := nullif(trim(p_record->>'kind'), '');
  v_resource_id := trim(p_record->'data'->>'id');
  v_provider := trim(p_record->'source'->>'provider');
  v_external_id := trim(p_record->'source'->>'externalId');
  v_source_url := trim(p_record->'source'->>'url');
  v_source_key := concat_ws(':', v_kind, v_provider, v_external_id);
  v_errors := private.editorial_import_record_errors(p_record);

  if exists (
    select 1
    from private.editorial_import_items
    where batch_id = v_batch_id
      and id <> p_item_id
      and source_key = v_source_key
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
  elsif v_duplicate then
    v_status := 'duplicate';
    v_decision := 'skip';
  else
    v_status := 'ready';
    v_decision := 'import';
  end if;

  update private.editorial_import_items
  set kind = v_kind,
      resource_id = v_resource_id,
      source_key = v_source_key,
      source_url = v_source_url,
      payload = p_record,
      status = v_status,
      decision = v_decision,
      errors = to_jsonb(v_errors)
  where id = p_item_id;

  update private.editorial_import_batches as batch
  set ready_count = counts.ready_count,
      duplicate_count = counts.duplicate_count,
      invalid_count = counts.invalid_count
  from (
    select
      count(*) filter (where status = 'ready')::integer as ready_count,
      count(*) filter (where status = 'duplicate')::integer as duplicate_count,
      count(*) filter (where status = 'invalid')::integer as invalid_count
    from private.editorial_import_items
    where batch_id = v_batch_id
  ) as counts
  where batch.id = v_batch_id;

  insert into private.admin_audit_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    auth.uid(),
    'import.item_updated',
    'editorial_import_item',
    p_item_id::text,
    jsonb_build_object(
      'batch_id', v_batch_id,
      'kind', v_kind,
      'resource_id', v_resource_id,
      'status', v_status
    )
  );

  return jsonb_build_object(
    'status', v_status,
    'decision', v_decision,
    'errors', to_jsonb(v_errors)
  );
end;
$$;

create or replace function public.admin_save_question(p_question jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := trim(p_question->>'id');
  v_publication_status text := coalesce(nullif(trim(p_question->>'publicationStatus'), ''), 'draft');
  v_previous_status text;
  v_alternative_count integer;
  v_correct text := trim(p_question->>'correct');
  v_action text;
begin
  if not private.has_admin_permission('content.write') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  if v_publication_status = 'published'
    and not private.has_admin_permission('content.publish') then
    raise exception 'Publish permission required' using errcode = '42501';
  end if;

  if v_id is null or v_id !~ '^[a-z0-9][a-z0-9-]{2,119}$' then
    raise exception 'Invalid question id' using errcode = '22023';
  end if;

  if v_publication_status not in ('draft', 'review', 'published', 'archived') then
    raise exception 'Invalid publication status' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_question->'alternatives', 'null'::jsonb)) <> 'array' then
    raise exception 'Alternatives must be an array' using errcode = '22023';
  end if;

  v_alternative_count := jsonb_array_length(p_question->'alternatives');
  if v_alternative_count not between 2 and 5 then
    raise exception 'Question must have between two and five alternatives' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(p_question->'alternatives') as alternative
    where trim(alternative->>'id') = v_correct
      and char_length(trim(alternative->>'text')) > 0
  ) then
    raise exception 'Correct alternative is missing' using errcode = '22023';
  end if;

  select publication_status into v_previous_status
  from public.questions
  where id = v_id;

  insert into public.questions (
    id, discipline, subject, topic, board, year, role, institution, concurso,
    level, difficulty, statement, alternatives, correct, explanation,
    publication_status, published_at, source_provider, source_external_id,
    source_url, source_collected_at, source_fingerprint, import_batch_id,
    created_by, updated_by
  ) values (
    v_id,
    trim(p_question->>'discipline'),
    trim(p_question->>'subject'),
    trim(p_question->>'topic'),
    trim(p_question->>'board'),
    (p_question->>'year')::integer,
    trim(p_question->>'role'),
    trim(p_question->>'institution'),
    trim(p_question->>'concurso'),
    trim(p_question->>'level'),
    trim(p_question->>'difficulty'),
    trim(p_question->>'statement'),
    p_question->'alternatives',
    v_correct,
    trim(p_question->>'explanation'),
    v_publication_status,
    case when v_publication_status = 'published'
      then coalesce(nullif(p_question->>'publishedAt', '')::timestamptz, timezone('utc', now()))
      else null
    end,
    nullif(trim(p_question->>'sourceProvider'), ''),
    nullif(trim(p_question->>'sourceExternalId'), ''),
    nullif(trim(p_question->>'sourceUrl'), ''),
    nullif(p_question->>'sourceCollectedAt', '')::timestamptz,
    nullif(trim(p_question->>'sourceFingerprint'), ''),
    nullif(p_question->>'importBatchId', '')::uuid,
    auth.uid(),
    auth.uid()
  )
  on conflict (id) do update set
    discipline = excluded.discipline,
    subject = excluded.subject,
    topic = excluded.topic,
    board = excluded.board,
    year = excluded.year,
    role = excluded.role,
    institution = excluded.institution,
    concurso = excluded.concurso,
    level = excluded.level,
    difficulty = excluded.difficulty,
    statement = excluded.statement,
    alternatives = excluded.alternatives,
    correct = excluded.correct,
    explanation = excluded.explanation,
    publication_status = excluded.publication_status,
    published_at = excluded.published_at,
    source_provider = coalesce(excluded.source_provider, questions.source_provider),
    source_external_id = coalesce(excluded.source_external_id, questions.source_external_id),
    source_url = coalesce(excluded.source_url, questions.source_url),
    source_collected_at = coalesce(excluded.source_collected_at, questions.source_collected_at),
    source_fingerprint = coalesce(excluded.source_fingerprint, questions.source_fingerprint),
    import_batch_id = coalesce(excluded.import_batch_id, questions.import_batch_id),
    updated_at = timezone('utc', now()),
    updated_by = auth.uid();

  v_action := case
    when v_previous_status is null then 'question.created'
    when v_previous_status <> 'published' and v_publication_status = 'published'
      then 'question.published'
    else 'question.updated'
  end;

  insert into private.admin_audit_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    auth.uid(),
    v_action,
    'question',
    v_id,
    jsonb_build_object(
      'discipline', trim(p_question->>'discipline'),
      'topic', trim(p_question->>'topic'),
      'publication_status', v_publication_status
    )
  );

  return jsonb_build_object('id', v_id, 'publicationStatus', v_publication_status);
end;
$$;

revoke all on function public.admin_list_questions() from public, anon;
revoke all on function public.admin_save_question(jsonb) from public, anon;
revoke all on function public.admin_create_import_batch(text, jsonb) from public, anon;
revoke all on function public.admin_list_import_batches() from public, anon;
revoke all on function public.admin_get_import_batch(uuid) from public, anon;
revoke all on function public.admin_set_import_item_decision(uuid, text) from public, anon;
revoke all on function public.admin_update_import_item(uuid, jsonb) from public, anon;
revoke all on function public.admin_apply_import_batch(uuid) from public, anon;
revoke all on function public.admin_rollback_import_batch(uuid) from public, anon;

grant execute on function public.admin_list_questions() to authenticated;
grant execute on function public.admin_save_question(jsonb) to authenticated;
grant execute on function public.admin_create_import_batch(text, jsonb) to authenticated;
grant execute on function public.admin_list_import_batches() to authenticated;
grant execute on function public.admin_get_import_batch(uuid) to authenticated;
grant execute on function public.admin_set_import_item_decision(uuid, text) to authenticated;
grant execute on function public.admin_update_import_item(uuid, jsonb) to authenticated;
grant execute on function public.admin_apply_import_batch(uuid) to authenticated;
grant execute on function public.admin_rollback_import_batch(uuid) to authenticated;

comment on table private.editorial_import_batches is
'Authenticated editorial staging batches. Collector output is validated here before content tables are changed.';

comment on table private.editorial_import_items is
'Per-record validation, duplicate decision, snapshot, and rollback state for editorial imports.';

comment on table public.questions is
'Editorial question bank. Only published rows are readable by the application.';
