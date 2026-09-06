import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const userA = '10000000-0000-4000-8000-000000000001';
const userB = '10000000-0000-4000-8000-000000000002';

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, name text not null, username text not null unique, avatar_path text, updated_at timestamptz default now());
    create table public.questions(id text primary key, correct text, alternatives jsonb, explanation text, publication_status text);
    create table public.flashcards(id text primary key, user_id uuid, archived_at timestamptz);
    insert into auth.users values ('${userA}','private-a@test.invalid'),('${userB}','private-b@test.invalid');
    insert into public.profiles(id,name,username) values ('${userA}','Ana Segura','ana_segura'),('${userB}','Bruno Privado','bruno_privado');
    insert into public.questions select 'q'||n, 'B', '[{"id":"A"},{"id":"B"}]', 'Comentário', 'published' from generate_series(1,1010) n;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20260902052712_study_levels.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20260906104313_gamification_ranking_achievements.sql', import.meta.url), 'utf8'));
  return db;
}

test('gamificação aplica RLS, opt-in privado e catálogo versionado', async () => {
  const db = await database();
  try {
    assert.equal((await db.query<{ count: number }>('select count(*)::integer count from public.achievement_definitions')).rows[0].count, 25);
    assert.deepEqual((await db.query<{ rules_version: number }>('select distinct rules_version from public.achievement_definitions')).rows.map(row => row.rules_version), [1]);
    assert.equal((await db.query<{ ranking_opt_in: boolean }>(`select ranking_opt_in from public.profiles where id='${userA}'`)).rows[0].ranking_opt_in, false);
    await db.exec(`
      insert into public.user_gamification_stats(user_id) values('${userA}'),('${userB}');
      insert into public.user_achievements(user_id,achievement_key) values
        ('${userA}','primeiro_passo'),('${userB}','primeiro_passo');
    `);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${userA}'`);
    assert.deepEqual(
      (await db.query<{ user_id: string }>('select user_id from public.user_gamification_stats')).rows.map(row => row.user_id),
      [userA],
    );
    assert.deepEqual(
      (await db.query<{ user_id: string }>('select user_id from public.user_achievements')).rows.map(row => row.user_id),
      [userA],
    );
    await assert.rejects(db.exec(`insert into public.user_achievements(user_id,achievement_key) values('${userA}','mil_questoes')`), /permission denied/);
    await assert.rejects(db.exec(`update public.user_gamification_stats set distinct_questions=1000`), /permission denied/);
    await db.exec('reset role');
    const rls = await db.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where relname in ('achievement_definitions','user_gamification_stats','user_achievements') order by relname`);
    assert.ok(rls.rows.every(row => row.relrowsecurity));
  } finally { await db.close(); }
});

test('estatísticas contam a primeira resposta válida e somente questões ainda publicadas', async () => {
  const db = await database();
  try {
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${userA}'`);
    await db.query(`select public.record_level_activity('{"id":"wrong","kind":"question","itemId":"q1","selected":"A","reviewed":false,"xp":999,"isCorrect":true,"occurredAt":"2000-01-01"}'::jsonb)`);
    await db.query(`select public.record_level_activity('{"id":"right-later","kind":"question","itemId":"q1","selected":"B","reviewed":false}'::jsonb)`);
    await db.query(`select public.record_level_activity('{"id":"right","kind":"question","itemId":"q2","selected":"B","reviewed":false}'::jsonb)`);
    await db.query(`select public.record_level_activity('{"id":"withdrawn","kind":"question","itemId":"q3","selected":"B","reviewed":false}'::jsonb)`);
    await db.query(`select public.record_level_activity('{"id":"invalid-answer","kind":"question","itemId":"q4","selected":"Z","reviewed":false}'::jsonb)`);
    await db.query(`select public.record_level_activity('{"id":"missing-question","kind":"question","itemId":"does-not-exist","selected":"B","reviewed":false}'::jsonb)`);
    await db.exec(`reset role; update public.questions set publication_status='withdrawn' where id='q3'; select private.refresh_user_gamification('${userA}',now()); set role authenticated; set request.jwt.claim.sub='${userA}'`);
    const stats = (await db.query<{ distinct_questions: number; distinct_correct: number }>(`select distinct_questions, distinct_correct from public.user_gamification_stats where user_id='${userA}'`)).rows[0];
    assert.deepEqual(stats, { distinct_questions: 2, distinct_correct: 1 });
    const xp = (await db.query<{ total_xp: number }>(`select total_xp from public.level_accounts where user_id='${userA}'`)).rows[0].total_xp;
    assert.ok(xp < 999);
  } finally { await db.close(); }
});

test('simulado exige dez questões publicadas diferentes', async () => {
  const db = await database();
  try {
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${userA}'`);
    const duplicateAnswers = Array.from({ length: 10 }, () => ({ itemId: 'q1', selected: 'B' }));
    const payload = JSON.stringify({ id: 'sim-duplicates', kind: 'simulation', itemId: 'sim-duplicates', answers: duplicateAnswers }).replaceAll("'", "''");
    await assert.rejects(db.query(`select public.record_level_activity('${payload}'::jsonb)`), /10 distinct questions/);
    const validAnswers = Array.from({ length: 10 }, (_, index) => ({ itemId: `q${index + 1}`, selected: 'B' }));
    const validPayload = JSON.stringify({ id: 'sim-valid', kind: 'simulation', itemId: 'sim-valid', answers: validAnswers }).replaceAll("'", "''");
    await db.query(`select public.record_level_activity('${validPayload}'::jsonb)`);
    assert.equal((await db.query<{ simulations_completed: number }>(`select simulations_completed from public.user_gamification_stats where user_id='${userA}'`)).rows[0].simulations_completed, 1);
  } finally { await db.close(); }
});

test('mil questões exige mil itens publicados diferentes e desbloqueia uma vez', async () => {
  const db = await database();
  try {
    await db.exec(`
      insert into public.level_accounts(user_id,total_xp) values('${userA}',10000);
      insert into public.level_events(user_id,event_id,item_id,kind,xp,reason,is_correct,day,received_at)
      select '${userA}', 'event-'||n, 'q'||n, 'question', 0, 'earned', true, '2026-09-06', now()
      from generate_series(1,999) n;
      select private.refresh_user_gamification('${userA}',now());
      select private.unlock_user_achievements('${userA}',now());
    `);
    assert.equal((await db.query<{ count: number }>(`select count(*)::integer count from public.user_achievements where user_id='${userA}' and achievement_key='mil_questoes'`)).rows[0].count, 0);
    await db.exec(`
      insert into public.level_events(user_id,event_id,item_id,kind,xp,reason,is_correct,day,received_at)
      values('${userA}','event-1000','q1000','question',0,'earned',true,'2026-09-06',now());
      select private.refresh_user_gamification('${userA}',now());
      select private.unlock_user_achievements('${userA}',now());
      select private.unlock_user_achievements('${userA}',now());
      select private.refresh_user_gamification('${userA}',now());
    `);
    assert.equal((await db.query<{ count: number }>(`select count(*)::integer count from public.user_achievements where user_id='${userA}' and achievement_key='mil_questoes'`)).rows[0].count, 1);
    assert.equal((await db.query<{ distinct_questions: number }>(`select distinct_questions from public.user_gamification_stats where user_id='${userA}'`)).rows[0].distinct_questions, 1000);
    assert.equal((await db.query<{ total_xp: number }>(`select total_xp from public.level_accounts where user_id='${userA}'`)).rows[0].total_xp, 10000);
  } finally { await db.close(); }
});

test('processamento concorrente tem bloqueio e chaves idempotentes no banco', async () => {
  const db = await database();
  try {
    const definition = (await db.query<{ definition: string }>(
      `select pg_get_functiondef('public.record_level_activity(jsonb)'::regprocedure) definition`,
    )).rows[0].definition;
    assert.match(definition, /for update/i);

    const constraints = (await db.query<{ definition: string }>(`
      select pg_get_constraintdef(oid) definition
      from pg_constraint
      where conrelid in ('public.level_events'::regclass, 'public.user_achievements'::regclass)
        and contype in ('p','u')
    `)).rows.map(row => row.definition);
    assert.ok(constraints.some(value => /UNIQUE \(user_id, event_id\)/i.test(value)));
    assert.ok(constraints.some(value => /PRIMARY KEY \(user_id, achievement_key\)/i.test(value)));
  } finally { await db.close(); }
});

test('ranking retorna apenas opt-in e não expõe email nem UUID', async () => {
  const db = await database();
  try {
    await db.exec(`
      insert into public.level_accounts(user_id,total_xp) values('${userA}',30),('${userB}',90);
      insert into public.level_events(user_id,event_id,item_id,kind,xp,reason,is_correct,day,received_at) values
        ('${userA}','a1','q1','question',10,'earned',true,'2026-09-06','2026-09-06T10:00:00Z'),
        ('${userA}','a2','q2','question',20,'earned',true,'2026-09-06','2026-09-06T11:00:00Z'),
        ('${userB}','b1','q3','question',20,'earned',true,'2026-09-06','2026-09-06T09:00:00Z');
      update public.profiles set ranking_opt_in=true where id='${userA}';
    `);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${userB}'`);
    const result = (await db.query<{ result: { entries: unknown[]; currentUser: { isPublic: boolean; rank: number } } }>(`select public.get_ranking('all',100,0) result`)).rows[0].result;
    assert.equal(result.entries.length, 1);
    assert.equal(result.currentUser.isPublic, false);
    assert.equal(result.currentUser.rank, 2);
    assert.doesNotMatch(JSON.stringify(result), /private-|10000000-/);
    await db.exec(`select public.set_ranking_opt_in(true)`);
    const visible = (await db.query<{ result: { entries: { username: string }[] } }>(`select public.get_ranking('all',100,0) result`)).rows[0].result;
    assert.deepEqual(visible.entries.map(item => item.username), ['ana_segura','bruno_privado']);
  } finally { await db.close(); }
});

test('RPC rejeita anônimo e usa períodos do servidor', async () => {
  const db = await database();
  try {
    await db.exec(`set role anon; set request.jwt.claim.sub=''`);
    await assert.rejects(db.exec(`select public.get_ranking('today',100,0)`), /permission denied/);
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${userA}'`);
    await assert.rejects(db.exec(`select public.get_ranking('week',100,0)`), /Invalid ranking period/);
    const bounded = (await db.query<{ result: { limit: number; offset: number } }>(
      `select public.get_ranking('today',null,2147483647) result`,
    )).rows[0].result;
    assert.equal(bounded.limit, 100);
    assert.equal(bounded.offset, 10000);
  } finally { await db.close(); }
});

test('ranking separa mês e total e desempata por quem alcançou antes', async () => {
  const db = await database();
  try {
    await db.exec(`
      insert into public.level_accounts(user_id,total_xp) values('${userA}',10),('${userB}',30);
      update public.profiles set ranking_opt_in=true;
      insert into public.level_events(user_id,event_id,item_id,kind,xp,reason,is_correct,day,received_at) values
        ('${userA}','today-a','q1','question',10,'earned',true,(now() at time zone 'America/Sao_Paulo')::date,now()-interval '2 hours'),
        ('${userB}','today-b','q2','question',10,'earned',true,(now() at time zone 'America/Sao_Paulo')::date,now()-interval '1 hour'),
        ('${userB}','old-b','q3','question',20,'earned',true,(date_trunc('month',now() at time zone 'America/Sao_Paulo')-interval '1 day')::date,now()-interval '40 days');
      set role authenticated; set request.jwt.claim.sub='${userA}';
    `);
    const today = (await db.query<{ result: { entries: { username: string; points: number }[] } }>(`select public.get_ranking('today',100,0) result`)).rows[0].result;
    assert.deepEqual(today.entries.map(entry => entry.username), ['ana_segura','bruno_privado']);
    const month = (await db.query<{ result: { entries: { username: string; points: number }[] } }>(`select public.get_ranking('month',100,0) result`)).rows[0].result;
    assert.deepEqual(month.entries.map(entry => entry.points), [10,10]);
    const all = (await db.query<{ result: { entries: { username: string; points: number }[] } }>(`select public.get_ranking('all',100,0) result`)).rows[0].result;
    assert.deepEqual(all.entries.map(entry => entry.username), ['bruno_privado','ana_segura']);
  } finally { await db.close(); }
});
