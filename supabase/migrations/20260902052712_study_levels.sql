begin;

create schema if not exists private;
create table public.level_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_xp bigint not null default 0 check (total_xp between 0 and 9007199254740991),
  rules_version integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.level_events (
  seq bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  item_id text not null,
  kind text not null check (kind in ('question','review','flashcard','simulation','consistency')),
  xp integer not null check (xp between 0 and 20),
  reason text not null check (reason in ('earned','repeated','daily_limit','ineligible')),
  is_correct boolean,
  day date not null,
  received_at timestamptz not null default now(),
  unique (user_id,event_id)
);
create index level_events_daily on public.level_events(user_id,day,kind) where xp > 0;
create index level_events_item on public.level_events(user_id,item_id,seq desc);
alter table public.level_accounts enable row level security;
alter table public.level_events enable row level security;
create policy level_accounts_read_own on public.level_accounts for select to authenticated using ((select auth.uid())=user_id);
create policy level_events_read_own on public.level_events for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.level_accounts, public.level_events from public, anon, authenticated;
grant select on public.level_accounts, public.level_events to authenticated;

-- Private helper called only while the account row is locked. No client XP, clock,
-- correctness, user_id or subscription data participates in the award calculation.
create function private.award_level_activity(p_user uuid, p_event jsonb, p_now timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_id text := p_event->>'id';
  v_item text := p_event->>'itemId';
  v_kind text := p_event->>'kind';
  v_day date := (p_now at time zone 'America/Sao_Paulo')::date;
  v_reason text := 'earned';
  v_xp integer := 0;
  v_cap integer := 0;
  v_correct boolean;
  v_question public.questions%rowtype;
  v_previous public.level_events%rowtype;
  v_answer jsonb;
  v_valid integer := 0;
begin
  if v_id is null or char_length(v_id) not between 1 and 240
    or v_item is null or char_length(v_item) not between 1 and 200
    or v_kind is null or v_kind not in ('question','flashcard','simulation') then
    raise exception 'Invalid level activity' using errcode='22023';
  end if;
  if exists (select 1 from public.level_events where user_id=p_user and event_id=v_id) then return; end if;
  if v_kind='question' then
    select * into v_question from public.questions where id=v_item and publication_status='published';
    if not found or not exists (select 1 from jsonb_array_elements(v_question.alternatives) a where a->>'id'=p_event->>'selected') then
      v_reason := 'ineligible';
    else
      v_correct := v_question.correct=p_event->>'selected';
      select * into v_previous from public.level_events where user_id=p_user and item_id=v_item and kind in ('question','review') and is_correct is not null order by seq desc limit 1;
      if not found then v_xp:=10; v_cap:=20;
      elsif p_event->>'reviewed'='true' and v_previous.is_correct=false and nullif(trim(v_question.explanation),'') is not null then
        v_kind:='review'; v_cap:=5;
        if exists (select 1 from public.level_events where user_id=p_user and item_id=v_item and kind='review' and xp>0 and received_at>p_now-interval '7 days') then v_reason:='repeated';
        else v_xp:=20; end if;
      else v_reason:='repeated'; end if;
    end if;
  elsif v_kind='flashcard' then
    v_cap:=10;
    if not exists (select 1 from public.flashcards where id=v_item and user_id=p_user and archived_at is null) then
      raise exception 'Owned flashcard not found' using errcode='22023';
    elsif p_event->>'rating' is null or p_event->>'rating' not in ('again','hard','good','easy') then v_reason:='ineligible';
    elsif exists (select 1 from public.level_events where user_id=p_user and item_id=v_item and kind='flashcard' and day=v_day) then v_reason:='repeated';
    else v_xp:=5; end if;
  else
    v_cap:=1;
    if jsonb_typeof(p_event->'answers') is distinct from 'array' or jsonb_array_length(p_event->'answers')>200 then
      raise exception 'Invalid simulation answers' using errcode='22023';
    end if;
    for v_answer in select distinct on (a->>'itemId') a from jsonb_array_elements(p_event->'answers') a order by a->>'itemId' loop
      if exists (select 1 from public.questions q where q.id=v_answer->>'itemId' and q.publication_status='published' and exists (select 1 from jsonb_array_elements(q.alternatives) opt where opt->>'id'=v_answer->>'selected')) then
        v_valid:=v_valid+1;
        perform private.award_level_activity(p_user,jsonb_build_object('id',v_id||':'||md5(v_answer->>'itemId'),'kind','question','itemId',v_answer->>'itemId','selected',v_answer->>'selected','reviewed',false),p_now);
      end if;
    end loop;
    if exists (select 1 from public.level_events where user_id=p_user and item_id=v_item and kind='simulation') then v_reason:='repeated';
    elsif v_valid>=10 then v_xp:=20;
    else v_reason:='ineligible'; end if;
  end if;
  if v_xp>0 and (select count(*) from public.level_events where user_id=p_user and kind=v_kind and day=v_day and xp>0)>=v_cap then
    v_xp:=0; v_reason:='daily_limit';
  end if;
  insert into public.level_events(user_id,event_id,item_id,kind,xp,reason,is_correct,day,received_at)
  values(p_user,v_id,v_item,v_kind,v_xp,v_reason,v_correct,v_day,p_now);
  update public.level_accounts set total_xp=total_xp+v_xp, updated_at=p_now where user_id=p_user;
  if (select count(*)>=3 and count(distinct (case when kind='flashcard' then 'c:' else 'q:' end)||item_id)>=2 from public.level_events where user_id=p_user and day=v_day and kind in ('question','review','flashcard') and xp>0)
    and not exists (select 1 from public.level_events where user_id=p_user and kind='consistency' and day=v_day) then
    insert into public.level_events(user_id,event_id,item_id,kind,xp,reason,day,received_at)
    values(p_user,'consistency:'||v_day,v_day::text,'consistency',20,'earned',v_day,p_now);
    update public.level_accounts set total_xp=total_xp+20, updated_at=p_now where user_id=p_user;
  end if;
end;
$$;
revoke all on function private.award_level_activity(uuid,jsonb,timestamptz) from public, anon, authenticated;

create function public.record_level_activity(p_event jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := (select auth.uid());
  v_total bigint;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.level_accounts(user_id) values(v_user) on conflict do nothing;
  select total_xp into v_total from public.level_accounts where user_id=v_user for update;
  if p_event is not null and p_event <> 'null'::jsonb then
    if char_length(p_event->>'id')>200 or octet_length(p_event::text)>65536 then
      raise exception 'Invalid level activity size' using errcode='22023';
    end if;
    perform private.award_level_activity(v_user,p_event,now());
    select total_xp into v_total from public.level_accounts where user_id=v_user;
  end if;
  return jsonb_build_object('totalXp',v_total,'rulesVersion',1);
end;
$$;
revoke all on function public.record_level_activity(jsonb) from public, anon, authenticated;
grant execute on function public.record_level_activity(jsonb) to authenticated;
comment on table public.level_events is 'Append-only XP receipts; daily quotas use server receipt time in America/Sao_Paulo. Never cleared by performance reset.';
commit;
