begin;

alter table public.profiles
add column if not exists ranking_opt_in boolean not null default false;

comment on column public.profiles.ranking_opt_in is
  'Opt-in explícito para aparecer no ranking público. Desativado por padrão.';

create table public.achievement_definitions (
  key text primary key check (key ~ '^[a-z0-9_]{3,64}$'),
  category text not null check (category in ('questions','accuracy','streak','simulations','flashcards','levels')),
  metric text not null check (metric in ('distinct_questions','distinct_correct','longest_streak','simulations_completed','flashcard_reviews','level')),
  title text not null check (char_length(title) between 1 and 80),
  description text not null check (char_length(description) between 1 and 180),
  threshold integer not null check (threshold > 0),
  icon text not null check (char_length(icon) between 1 and 64),
  rules_version integer not null default 1 check (rules_version > 0),
  sort_order integer not null unique,
  active boolean not null default true
);

create table public.user_gamification_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  distinct_questions integer not null default 0 check (distinct_questions >= 0),
  distinct_correct integer not null default 0 check (distinct_correct >= 0),
  simulations_completed integer not null default 0 check (simulations_completed >= 0),
  flashcard_reviews integer not null default 0 check (flashcard_reviews >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_day date,
  updated_at timestamptz not null default now()
);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null references public.achievement_definitions(key) on delete restrict,
  unlocked_at timestamptz not null default now(),
  progress_snapshot jsonb not null default '{}'::jsonb,
  primary key (user_id, achievement_key)
);

create index user_achievements_recent
on public.user_achievements(user_id, unlocked_at desc);

create index level_events_ranking_period
on public.level_events(day, user_id, received_at)
include (xp)
where xp > 0;

alter table public.achievement_definitions enable row level security;
alter table public.user_gamification_stats enable row level security;
alter table public.user_achievements enable row level security;

create policy achievement_definitions_read
on public.achievement_definitions for select
to authenticated
using (active);

create policy user_gamification_stats_read_own
on public.user_gamification_stats for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_achievements_read_own
on public.user_achievements for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.achievement_definitions, public.user_gamification_stats, public.user_achievements
from public, anon, authenticated;
grant select on public.achievement_definitions, public.user_gamification_stats, public.user_achievements
to authenticated;

insert into public.achievement_definitions
  (key, category, metric, title, description, threshold, icon, sort_order)
values
  ('primeiro_passo','questions','distinct_questions','Primeiro passo','Responda sua primeira questão.',1,'footsteps-outline',10),
  ('aquecimento','questions','distinct_questions','Aquecimento','Responda 10 questões diferentes.',10,'flame-outline',20),
  ('ritmo_firme','questions','distinct_questions','Ritmo firme','Responda 50 questões diferentes.',50,'walk-outline',30),
  ('centenario','questions','distinct_questions','Centenário','Responda 100 questões diferentes.',100,'ribbon-outline',40),
  ('maratonista_250','questions','distinct_questions','Maratonista','Responda 250 questões diferentes.',250,'fitness-outline',50),
  ('meio_milhar','questions','distinct_questions','Meio milhar','Responda 500 questões diferentes.',500,'medal-outline',60),
  ('mil_questoes','questions','distinct_questions','Mil questões','Responda 1.000 questões diferentes.',1000,'trophy-outline',70),
  ('dez_acertos','accuracy','distinct_correct','Na direção certa','Acerte 10 questões diferentes.',10,'checkmark-circle-outline',110),
  ('cem_acertos','accuracy','distinct_correct','Precisão','Acerte 100 questões diferentes.',100,'locate-outline',120),
  ('quinhentos_acertos','accuracy','distinct_correct','Domínio','Acerte 500 questões diferentes.',500,'shield-checkmark-outline',130),
  ('sequencia_3','streak','longest_streak','Três dias','Estude por 3 dias consecutivos.',3,'calendar-outline',210),
  ('sequencia_7','streak','longest_streak','Uma semana','Estude por 7 dias consecutivos.',7,'calendar-number-outline',220),
  ('sequencia_30','streak','longest_streak','Um mês de constância','Estude por 30 dias consecutivos.',30,'flame-outline',230),
  ('sequencia_100','streak','longest_streak','Cem dias','Estude por 100 dias consecutivos.',100,'infinite-outline',240),
  ('primeiro_simulado','simulations','simulations_completed','Primeiro simulado','Conclua um simulado válido.',1,'stopwatch-outline',310),
  ('simulados_10','simulations','simulations_completed','Treino de prova','Conclua 10 simulados válidos.',10,'timer-outline',320),
  ('simulados_50','simulations','simulations_completed','Veterano de simulados','Conclua 50 simulados válidos.',50,'podium-outline',330),
  ('flashcards_10','flashcards','flashcard_reviews','Memória ativa','Faça 10 revisões válidas de flashcards.',10,'albums-outline',410),
  ('flashcards_100','flashcards','flashcard_reviews','Revisão constante','Faça 100 revisões válidas de flashcards.',100,'layers-outline',420),
  ('flashcards_500','flashcards','flashcard_reviews','Memória de longo prazo','Faça 500 revisões válidas de flashcards.',500,'library-outline',430),
  ('nivel_10','levels','level','Nível 10','Alcance o nível 10.',10,'star-outline',510),
  ('nivel_25','levels','level','Nível 25','Alcance o nível 25.',25,'star-half-outline',520),
  ('nivel_50','levels','level','Nível 50','Alcance o nível 50.',50,'star-outline',530),
  ('nivel_75','levels','level','Nível 75','Alcance o nível 75.',75,'sparkles-outline',540),
  ('nivel_100','levels','level','Nível 100','Alcance o nível máximo.',100,'diamond-outline',550)
on conflict (key) do update set
  category = excluded.category,
  metric = excluded.metric,
  title = excluded.title,
  description = excluded.description,
  threshold = excluded.threshold,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  active = true;

create function private.level_for_xp(p_total bigint)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(max(level), 0)::integer
  from generate_series(0, 100) as level
  where 15::bigint * level * level + 135::bigint * level <= greatest(p_total, 0);
$$;

revoke all on function private.level_for_xp(bigint) from public, anon, authenticated;

create function private.refresh_user_gamification(p_user uuid, p_now timestamptz)
returns public.user_gamification_stats
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'America/Sao_Paulo')::date;
  v_last_day date;
  v_current integer := 0;
  v_longest integer := 0;
  v_stats public.user_gamification_stats%rowtype;
begin
  select max(day) into v_last_day
  from public.level_events
  where user_id = p_user and xp > 0;

  with activity_days as (
    select distinct day
    from public.level_events
    where user_id = p_user and xp > 0
  ), numbered as (
    select day, day - row_number() over (order by day)::integer as run_key
    from activity_days
  ), runs as (
    select min(day) as run_start, max(day) as run_end, count(*)::integer as run_length
    from numbered
    group by run_key
  )
  select coalesce(max(run_length), 0),
         coalesce(max(run_length) filter (where run_end = v_last_day), 0)
  into v_longest, v_current
  from runs;

  if v_last_day is null or v_last_day < v_today - 1 then
    v_current := 0;
  end if;

  with first_published_answers as (
    select distinct on (e.item_id) e.item_id, e.is_correct
    from public.level_events e
    join public.questions q
      on q.id = e.item_id and q.publication_status = 'published'
    where e.user_id = p_user
      and e.kind in ('question','review')
      and e.is_correct is not null
    order by e.item_id, e.seq
  )
  insert into public.user_gamification_stats (
    user_id, distinct_questions, distinct_correct, simulations_completed,
    flashcard_reviews, current_streak, longest_streak, last_active_day, updated_at
  )
  select p_user,
    (select count(*)::integer from first_published_answers),
    (select count(*)::integer from first_published_answers where is_correct),
    (select count(distinct item_id)::integer from public.level_events
      where user_id = p_user and kind = 'simulation' and reason in ('earned','daily_limit')),
    (select count(*)::integer from public.level_events
      where user_id = p_user and kind = 'flashcard' and reason in ('earned','daily_limit')),
    v_current,
    v_longest,
    v_last_day,
    p_now
  on conflict (user_id) do update set
    distinct_questions = excluded.distinct_questions,
    distinct_correct = excluded.distinct_correct,
    simulations_completed = excluded.simulations_completed,
    flashcard_reviews = excluded.flashcard_reviews,
    current_streak = excluded.current_streak,
    longest_streak = excluded.longest_streak,
    last_active_day = excluded.last_active_day,
    updated_at = excluded.updated_at
  returning * into v_stats;

  return v_stats;
end;
$$;

revoke all on function private.refresh_user_gamification(uuid,timestamptz) from public, anon, authenticated;

create function private.unlock_user_achievements(p_user uuid, p_now timestamptz)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  with metrics as (
    select
      s.*,
      private.level_for_xp(coalesce(a.total_xp, 0)) as level
    from public.user_gamification_stats s
    left join public.level_accounts a on a.user_id = s.user_id
    where s.user_id = p_user
  ), eligible as (
    select d.*,
      case d.metric
        when 'distinct_questions' then m.distinct_questions
        when 'distinct_correct' then m.distinct_correct
        when 'longest_streak' then m.longest_streak
        when 'simulations_completed' then m.simulations_completed
        when 'flashcard_reviews' then m.flashcard_reviews
        when 'level' then m.level
      end as metric_value
    from public.achievement_definitions d
    cross join metrics m
    where d.active
  ), inserted as (
    insert into public.user_achievements(user_id, achievement_key, unlocked_at, progress_snapshot)
    select p_user, key, p_now, jsonb_build_object('value', metric_value, 'threshold', threshold)
    from eligible
    where metric_value >= threshold
    on conflict (user_id, achievement_key) do nothing
    returning achievement_key, unlocked_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', d.key,
    'category', d.category,
    'title', d.title,
    'description', d.description,
    'icon', d.icon,
    'unlockedAt', i.unlocked_at
  ) order by d.sort_order), '[]'::jsonb)
  into v_result
  from inserted i
  join public.achievement_definitions d on d.key = i.achievement_key;

  return v_result;
end;
$$;

revoke all on function private.unlock_user_achievements(uuid,timestamptz) from public, anon, authenticated;

create function private.user_achievement_progress(p_user uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with metrics as (
    select
      coalesce(s.distinct_questions, 0) as distinct_questions,
      coalesce(s.distinct_correct, 0) as distinct_correct,
      coalesce(s.longest_streak, 0) as longest_streak,
      coalesce(s.simulations_completed, 0) as simulations_completed,
      coalesce(s.flashcard_reviews, 0) as flashcard_reviews,
      private.level_for_xp(coalesce(a.total_xp, 0)) as level
    from (select 1) seed
    left join public.user_gamification_stats s on s.user_id = p_user
    left join public.level_accounts a on a.user_id = p_user
  ), progress as (
    select d.*,
      case d.metric
        when 'distinct_questions' then m.distinct_questions
        when 'distinct_correct' then m.distinct_correct
        when 'longest_streak' then m.longest_streak
        when 'simulations_completed' then m.simulations_completed
        when 'flashcard_reviews' then m.flashcard_reviews
        when 'level' then m.level
      end as metric_value,
      ua.unlocked_at
    from public.achievement_definitions d
    cross join metrics m
    left join public.user_achievements ua
      on ua.user_id = p_user and ua.achievement_key = d.key
    where d.active
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', key,
    'category', category,
    'metric', metric,
    'title', title,
    'description', description,
    'threshold', threshold,
    'icon', icon,
    'sortOrder', sort_order,
    'value', metric_value,
    'progress', least(1, metric_value::numeric / threshold),
    'unlockedAt', unlocked_at
  ) order by sort_order), '[]'::jsonb)
  from progress;
$$;

revoke all on function private.user_achievement_progress(uuid) from public, anon, authenticated;

create or replace function public.record_level_activity(p_event jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_now timestamptz := now();
  v_before bigint;
  v_total bigint;
  v_distinct_simulation_questions integer;
  v_new jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.level_accounts(user_id) values(v_user) on conflict do nothing;
  select total_xp into v_before from public.level_accounts where user_id = v_user for update;

  if p_event is not null and p_event <> 'null'::jsonb then
    if char_length(p_event->>'id') > 200 or octet_length(p_event::text) > 65536 then
      raise exception 'Invalid level activity size' using errcode = '22023';
    end if;
    if p_event->>'kind' = 'simulation' then
      if jsonb_typeof(p_event->'answers') is distinct from 'array' then
        raise exception 'Invalid simulation answers' using errcode = '22023';
      end if;
      select count(distinct answer->>'itemId')::integer
      into v_distinct_simulation_questions
      from jsonb_array_elements(p_event->'answers') answer;
      if v_distinct_simulation_questions < 10 then
        raise exception 'Simulation requires 10 distinct questions' using errcode = '22023';
      end if;
    end if;
    perform private.award_level_activity(v_user, p_event, v_now);
  end if;

  select total_xp into v_total from public.level_accounts where user_id = v_user;
  perform private.refresh_user_gamification(v_user, v_now);
  if p_event is not null and p_event <> 'null'::jsonb then
    v_new := private.unlock_user_achievements(v_user, v_now);
  end if;

  return jsonb_build_object(
    'totalXp', v_total,
    'level', private.level_for_xp(v_total),
    'awardedXp', greatest(v_total - v_before, 0),
    'rulesVersion', 1,
    'achievements', private.user_achievement_progress(v_user),
    'newAchievements', v_new
  );
end;
$$;

revoke all on function public.record_level_activity(jsonb) from public, anon, authenticated;
grant execute on function public.record_level_activity(jsonb) to authenticated;

create function public.set_ranking_opt_in(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.profiles set ranking_opt_in = coalesce(p_enabled, false) where id = v_user;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return coalesce(p_enabled, false);
end;
$$;

revoke all on function public.set_ranking_opt_in(boolean) from public, anon, authenticated;
grant execute on function public.set_ranking_opt_in(boolean) to authenticated;

create function public.get_ranking(
  p_period text default 'today',
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_start date;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 10000);
  v_entries jsonb;
  v_current jsonb;
  v_total integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_period not in ('today','month','all') then
    raise exception 'Invalid ranking period' using errcode = '22023';
  end if;
  v_start := case p_period
    when 'today' then v_today
    when 'month' then date_trunc('month', v_today)::date
    else null
  end;

  with event_scores as (
    select user_id, coalesce(sum(xp), 0)::bigint as score,
      count(*) filter (where xp > 0)::integer as activity_count,
      max(received_at) filter (where xp > 0) as reached_at
    from public.level_events
    where xp > 0 and (v_start is null or day >= v_start)
    group by user_id
  ), public_scores as (
    select p.id, p.name, p.username, a.total_xp, coalesce(e.score, 0)::bigint as score,
      coalesce(e.activity_count, 0) as activity_count, e.reached_at
    from public.profiles p
    join public.level_accounts a on a.user_id = p.id
    left join event_scores e on e.user_id = p.id
    where p.ranking_opt_in
  ), ranked as (
    select *, row_number() over (
      order by score desc, activity_count desc, reached_at asc nulls last, username asc nulls last, id asc
    )::integer as rank
    from public_scores
  ), page as (
    select * from ranked order by rank limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', name,
    'username', username,
    'points', score,
    'level', private.level_for_xp(total_xp),
    'activityCount', activity_count,
    'rank', rank
  ) order by rank), '[]'::jsonb)
  into v_entries
  from page;

  with event_scores as (
    select user_id, coalesce(sum(xp), 0)::bigint as score,
      count(*) filter (where xp > 0)::integer as activity_count,
      max(received_at) filter (where xp > 0) as reached_at
    from public.level_events
    where xp > 0 and (v_start is null or day >= v_start)
    group by user_id
  ), public_scores as (
    select p.id, p.username, a.total_xp, coalesce(e.score, 0)::bigint as score,
      coalesce(e.activity_count, 0) as activity_count, e.reached_at
    from public.profiles p
    join public.level_accounts a on a.user_id = p.id
    left join event_scores e on e.user_id = p.id
    where p.ranking_opt_in
  ), me as (
    select p.name, p.username, p.ranking_opt_in, coalesce(a.total_xp, 0)::bigint as total_xp,
      coalesce(e.score, 0)::bigint as score,
      coalesce(e.activity_count, 0) as activity_count,
      e.reached_at
    from public.profiles p
    left join public.level_accounts a on a.user_id = p.id
    left join event_scores e on e.user_id = p.id
    where p.id = v_user
  )
  select jsonb_build_object(
    'name', me.name,
    'username', me.username,
    'points', me.score,
    'level', private.level_for_xp(me.total_xp),
    'activityCount', me.activity_count,
    'isPublic', me.ranking_opt_in,
    'rank', 1 + (select count(*) from public_scores s where
      s.score > me.score
      or (s.score = me.score and s.activity_count > me.activity_count)
      or (s.score = me.score and s.activity_count = me.activity_count and coalesce(s.reached_at, 'infinity'::timestamptz) < coalesce(me.reached_at, 'infinity'::timestamptz))
      or (s.score = me.score and s.activity_count = me.activity_count and coalesce(s.reached_at, 'infinity'::timestamptz) = coalesce(me.reached_at, 'infinity'::timestamptz) and coalesce(s.username, '') < coalesce(me.username, ''))
      or (s.score = me.score and s.activity_count = me.activity_count and coalesce(s.reached_at, 'infinity'::timestamptz) = coalesce(me.reached_at, 'infinity'::timestamptz) and coalesce(s.username, '') = coalesce(me.username, '') and s.id < v_user)
    )
  )
  into v_current
  from me;

  select count(*)::integer into v_total
  from public.profiles p
  join public.level_accounts a on a.user_id = p.id
  where p.ranking_opt_in;

  return jsonb_build_object(
    'period', p_period,
    'entries', v_entries,
    'currentUser', v_current,
    'totalParticipants', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

revoke all on function public.get_ranking(text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_ranking(text,integer,integer) to authenticated;

do $$
declare
  v_account record;
begin
  for v_account in select user_id from public.level_accounts loop
    perform private.refresh_user_gamification(v_account.user_id, now());
    perform private.unlock_user_achievements(v_account.user_id, now());
  end loop;
end;
$$;

comment on table public.user_achievements is
  'Conquistas permanentes, desbloqueadas uma vez a partir de eventos de estudo validados no servidor.';
comment on function public.get_ranking(text,integer,integer) is
  'Ranking opt-in por XP validado. Retorna somente nome público, username, XP, nível e posição.';

commit;
