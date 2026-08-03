create table if not exists public.concursos (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  short_name text not null check (char_length(short_name) between 2 and 40),
  icon text not null default 'business-outline',
  icon_color text not null default '#6D28D9' check (icon_color ~ '^#[0-9A-Fa-f]{6}$'),
  organ text not null check (char_length(organ) between 3 and 180),
  title text not null check (char_length(title) between 3 and 180),
  board text not null check (char_length(board) between 2 and 80),
  state text not null check (char_length(state) between 2 and 30),
  city text,
  region text not null check (
    region in ('Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Nacional')
  ),
  levels text[] not null check (
    cardinality(levels) > 0
    and levels <@ array['Fundamental', 'Médio', 'Superior']::text[]
  ),
  vacancies integer not null default 0 check (vacancies >= 0),
  salary_min numeric(12, 2) not null default 0 check (salary_min >= 0),
  salary_max numeric(12, 2) not null default 0 check (salary_max >= salary_min),
  registration_start date,
  registration_end date,
  exam_date date,
  fee numeric(10, 2) check (fee is null or fee >= 0),
  status text not null check (status in ('aberto', 'previsto', 'encerrado')),
  highlights text[] not null default '{}'::text[],
  edital_url text not null check (edital_url ~ '^https://'),
  publication_status text not null default 'draft' check (
    publication_status in ('draft', 'review', 'published', 'archived')
  ),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.concurso_roles (
  id bigint generated always as identity primary key,
  concurso_id text not null references public.concursos (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 180),
  vacancies integer not null default 0 check (vacancies >= 0),
  salary numeric(12, 2) not null default 0 check (salary >= 0),
  level text not null check (level in ('Fundamental', 'Médio', 'Superior')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists concursos_publication_status_idx
on public.concursos (publication_status, updated_at desc);

create index if not exists concurso_roles_concurso_idx
on public.concurso_roles (concurso_id, sort_order);

alter table public.concursos enable row level security;
alter table public.concurso_roles enable row level security;

drop policy if exists "concursos_read_published" on public.concursos;
create policy "concursos_read_published"
on public.concursos for select
to anon, authenticated
using (publication_status = 'published');

drop policy if exists "concurso_roles_read_published" on public.concurso_roles;
create policy "concurso_roles_read_published"
on public.concurso_roles for select
to anon, authenticated
using (
  exists (
    select 1
    from public.concursos
    where concursos.id = concurso_roles.concurso_id
      and concursos.publication_status = 'published'
  )
);

revoke all on table public.concursos from public, anon, authenticated;
revoke all on table public.concurso_roles from public, anon, authenticated;
grant select on table public.concursos to anon, authenticated;
grant select on table public.concurso_roles to anon, authenticated;

create or replace function public.admin_list_concursos()
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
      'updatedAt', concurso.updated_at,
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
    ) as item
    from public.concursos as concurso
  ) as items;

  return result;
end;
$$;

create or replace function public.admin_save_concurso(p_concurso jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := trim(p_concurso->>'id');
  v_publication_status text := coalesce(nullif(trim(p_concurso->>'publicationStatus'), ''), 'draft');
  v_previous_status text;
  v_levels text[];
  v_highlights text[];
  v_role_count integer;
  v_action text;
begin
  if not private.has_admin_permission('content.write') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  if v_publication_status = 'published'
    and not private.has_admin_permission('content.publish') then
    raise exception 'Publish permission required' using errcode = '42501';
  end if;

  if v_id is null or v_id !~ '^[a-z0-9][a-z0-9-]{2,79}$' then
    raise exception 'Invalid concurso id' using errcode = '22023';
  end if;

  if v_publication_status not in ('draft', 'review', 'published', 'archived') then
    raise exception 'Invalid publication status' using errcode = '22023';
  end if;

  select array_agg(level_value)
  into v_levels
  from jsonb_array_elements_text(coalesce(p_concurso->'levels', '[]'::jsonb)) as level_value;

  select coalesce(array_agg(highlight_value), '{}'::text[])
  into v_highlights
  from jsonb_array_elements_text(coalesce(p_concurso->'highlights', '[]'::jsonb)) as highlight_value;

  select count(*)
  into v_role_count
  from jsonb_array_elements(coalesce(p_concurso->'roles', '[]'::jsonb));

  if coalesce(cardinality(v_levels), 0) = 0 then
    raise exception 'At least one education level is required' using errcode = '22023';
  end if;

  if v_role_count = 0 then
    raise exception 'At least one role is required' using errcode = '22023';
  end if;

  select publication_status
  into v_previous_status
  from public.concursos
  where id = v_id;

  insert into public.concursos (
    id, short_name, icon, icon_color, organ, title, board, state, city, region,
    levels, vacancies, salary_min, salary_max, registration_start, registration_end,
    exam_date, fee, status, highlights, edital_url, publication_status, published_at,
    created_by, updated_by
  ) values (
    v_id,
    trim(p_concurso->>'shortName'),
    coalesce(nullif(trim(p_concurso->>'icon'), ''), 'business-outline'),
    coalesce(nullif(trim(p_concurso->>'iconColor'), ''), '#6D28D9'),
    trim(p_concurso->>'organ'),
    trim(p_concurso->>'title'),
    trim(p_concurso->>'board'),
    trim(p_concurso->>'state'),
    nullif(trim(p_concurso->>'city'), ''),
    trim(p_concurso->>'region'),
    v_levels,
    coalesce((p_concurso->>'vacancies')::integer, 0),
    coalesce((p_concurso->>'salaryMin')::numeric, 0),
    coalesce((p_concurso->>'salaryMax')::numeric, 0),
    nullif(p_concurso->>'registrationStart', '')::date,
    nullif(p_concurso->>'registrationEnd', '')::date,
    nullif(p_concurso->>'examDate', '')::date,
    nullif(p_concurso->>'fee', '')::numeric,
    trim(p_concurso->>'status'),
    v_highlights,
    trim(p_concurso->>'editalUrl'),
    v_publication_status,
    case when v_publication_status = 'published'
      then coalesce(nullif(p_concurso->>'publishedAt', '')::timestamptz, timezone('utc', now()))
      else null
    end,
    auth.uid(),
    auth.uid()
  )
  on conflict (id) do update set
    short_name = excluded.short_name,
    icon = excluded.icon,
    icon_color = excluded.icon_color,
    organ = excluded.organ,
    title = excluded.title,
    board = excluded.board,
    state = excluded.state,
    city = excluded.city,
    region = excluded.region,
    levels = excluded.levels,
    vacancies = excluded.vacancies,
    salary_min = excluded.salary_min,
    salary_max = excluded.salary_max,
    registration_start = excluded.registration_start,
    registration_end = excluded.registration_end,
    exam_date = excluded.exam_date,
    fee = excluded.fee,
    status = excluded.status,
    highlights = excluded.highlights,
    edital_url = excluded.edital_url,
    publication_status = excluded.publication_status,
    published_at = excluded.published_at,
    updated_at = timezone('utc', now()),
    updated_by = auth.uid();

  delete from public.concurso_roles where concurso_id = v_id;

  insert into public.concurso_roles (
    concurso_id, name, vacancies, salary, level, sort_order
  )
  select
    v_id,
    trim(role_value->>'name'),
    coalesce((role_value->>'vacancies')::integer, 0),
    coalesce((role_value->>'salary')::numeric, 0),
    trim(role_value->>'level'),
    (role_index - 1)::integer
  from jsonb_array_elements(p_concurso->'roles') with ordinality
    as roles(role_value, role_index);

  v_action := case
    when v_previous_status is null then 'concurso.created'
    when v_previous_status <> 'published' and v_publication_status = 'published'
      then 'concurso.published'
    else 'concurso.updated'
  end;

  insert into private.admin_audit_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    auth.uid(),
    v_action,
    'concurso',
    v_id,
    jsonb_build_object(
      'title', trim(p_concurso->>'title'),
      'publication_status', v_publication_status,
      'roles_count', v_role_count
    )
  );

  return jsonb_build_object('id', v_id, 'publicationStatus', v_publication_status);
end;
$$;

create or replace function public.admin_delete_concurso(p_concurso_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  if not private.has_admin_permission('content.write') then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select title into v_title
  from public.concursos
  where id = p_concurso_id;

  if v_title is null then
    raise exception 'Concurso not found' using errcode = 'P0002';
  end if;

  delete from public.concursos where id = p_concurso_id;

  insert into private.admin_audit_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    auth.uid(),
    'concurso.deleted',
    'concurso',
    p_concurso_id,
    jsonb_build_object('title', v_title)
  );
end;
$$;

revoke all on function public.admin_list_concursos() from public, anon;
revoke all on function public.admin_save_concurso(jsonb) from public, anon;
revoke all on function public.admin_delete_concurso(text) from public, anon;
grant execute on function public.admin_list_concursos() to authenticated;
grant execute on function public.admin_save_concurso(jsonb) to authenticated;
grant execute on function public.admin_delete_concurso(text) to authenticated;

comment on table public.concursos is
'Editorial concurso records. Only published rows are visible to the mobile application.';

comment on table public.concurso_roles is
'Structured positions associated with editorial concurso records.';
