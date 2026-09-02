import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('level RPC validates content, isolates owners, deduplicates and protects the ledger', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      create table public.questions(id text primary key, correct text, alternatives jsonb, explanation text, publication_status text);
      create table public.flashcards(id text primary key, user_id uuid, archived_at timestamptz);
      insert into auth.users values ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
      insert into public.questions select 'q'||n, 'B', '[{"id":"A","text":"A"},{"id":"B","text":"B"}]', 'Comentário de estudo', 'published' from generate_series(1,30) n;
      insert into public.questions values ('draft','B','[{"id":"A"},{"id":"B"}]','Comentário','draft');
      insert into public.flashcards values ('c1','10000000-0000-4000-8000-000000000001',null);
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20260902052712_study_levels.sql', import.meta.url), 'utf8'));
    await db.exec(`set role authenticated; set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';`);
    const rpc = async (event: unknown = null) => {
      const r = await db.query<{ result: { totalXp: number } }>('select public.record_level_activity($1::jsonb) result', [JSON.stringify(event)]);
      return r.rows[0].result.totalXp;
    };
    assert.equal(await rpc(), 0);
    const q = (id: string, itemId: string, selected = 'A', reviewed = false) => ({ id, kind: 'question', itemId, selected, reviewed });
    assert.equal(await rpc(q('e1', 'q1')), 10);
    assert.equal(await rpc(q('e1', 'q1')), 10);
    assert.equal(await rpc({ ...q('e2', 'q1'), xp: 999999, isCorrect: true }), 10);
    assert.equal(await rpc(q('e3', 'q1', 'B', true)), 30);
    assert.equal(await rpc(q('e4', 'q1', 'B', true)), 30);
    assert.equal(await rpc(q('e5', 'draft')), 30);
    assert.equal(await rpc(q('e6', 'q2', 'E')), 30);
    assert.equal(await rpc(q('e7', 'q2')), 60);
    for (let i = 3; i <= 25; i++) await rpc(q(`qevent${i}`, `q${i}`));
    assert.equal(await rpc(), 240);
    await assert.rejects(db.exec(`update public.level_accounts set total_xp=99999`), /permission denied/);
    await assert.rejects(db.exec(`delete from public.level_events`), /permission denied/);
    await assert.rejects(db.exec(`insert into public.level_events(user_id,event_id,item_id,kind,xp,day,reason) values(auth.uid(),'fake','q','question',99999,current_date,'earned')`), /permission denied/);
    await db.exec(`set request.jwt.claim.sub='10000000-0000-4000-8000-000000000002'`);
    assert.equal(await rpc(), 0);
    await assert.rejects(rpc({ id: 'card-a', kind: 'flashcard', itemId: 'c1', rating: 'good' }), /Owned flashcard not found/);
    assert.equal((await db.query('select * from public.level_events')).rows.length, 0);
    const answers = Array.from({ length: 10 }, (_, i) => ({ itemId: `q${i+1}`, selected: 'A' }));
    assert.equal(await rpc({ id: 'sim1', kind: 'simulation', itemId: 'sim1', answers }), 140);
    assert.equal(await rpc({ id: 'sim2', kind: 'simulation', itemId: 'sim2', answers }), 140);
    await db.exec(`set request.jwt.claim.sub=''`);
    await assert.rejects(rpc(), /Authentication required/);
    await db.exec('set role anon');
    await assert.rejects(rpc(), /permission denied/);
  } finally { await db.close(); }
});
