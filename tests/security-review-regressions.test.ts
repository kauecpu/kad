import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { paymentSetupSql, paymentFixtureSql } from './helpers/payment-database.ts';
import { classifyGooglePurchase } from '../supabase/functions/_shared/google-play.ts';
import { nextSyncTimestamp as appTimestamp } from '../lib/user-sync.ts';
import { nextSyncTimestamp as siteTimestamp } from '../site/src/core/user-sync.ts';

const A = '10000000-0000-4000-8000-000000000001';
const sql = (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const created = '2026-01-01T00:00:00.000Z';
const versionMigration = '20261009231430_preserve_simulation_sync_version.sql';
const session = {
  id: 'review-session', status: 'active', createdAt: created,
  config: { questionCount: 2 },
  questions: [{ questionId: 'q1', alternativeOrder: ['A', 'B'] }, { questionId: 'q2', alternativeOrder: ['A', 'B'] }],
  remainingSeconds: 300,
};

async function setup() {
  const db = new PGlite(); // In-memory only: no database URL or external service.
  await db.exec(await paymentSetupSql());
  await db.exec(paymentFixtureSql);
  await db.exec(await sql('202608300001_google_play_billing.sql'));
  await db.exec(await sql('20261009210911_google_play_entitlement_revalidation.sql'));
  return db;
}

async function studySetup(db: PGlite, fixed = true) {
  await db.exec(`create table public.profiles(id uuid primary key); create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
  await db.exec(await sql('20260816030000_sync_user_study_data.sql'));
  await db.exec(await sql('20261008003639_enforce_simulation_entitlements.sql'));
  if (fixed) await db.exec(await sql(versionMigration));
  await db.query(`insert into public.subscriptions
    (user_id,plan,billing_cycle,provider,provider_subscription_id,provider_status,status,started_at,current_period_end)
    values($1,'diamond','monthly','mercado_pago','synthetic-paid','active','active',now(),now()+interval '1 day')`, [A]);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${A}'`);
}

async function sync(db: PGlite, answers: Record<string, string>, updatedAt: string, patch = {}) {
  const p = { ...session, answers, updatedAt, ...patch };
  await db.query('select public.sync_simulation_session($1::uuid,$2,$3,$4::jsonb,$5::timestamptz,$6::timestamptz,$7::timestamptz)',
    [A, p.id, p.status, JSON.stringify(p), created, p.status === 'completed' ? updatedAt : null, updatedAt]);
}

for (const offset of [600_000, -600_000]) {
  test(`simulado: relógio ${offset > 0 ? 'adiantado' : 'atrasado'} não perde progresso por replay`, async () => {
    const db = await setup();
    try {
      await studySetup(db);
      const base = Date.now() + offset;
      const time = (delta: number) => new Date(base + delta).toISOString();
      await sync(db, {}, time(0));
      await sync(db, { q1: 'A' }, time(10_000));
      await sync(db, { q1: 'A', q2: 'B' }, time(20_000));
      const readAnswers = async () => (await db.query<{ answers: Record<string, string> }>(
        "select payload->'answers' as answers from public.simulation_sessions")).rows[0].answers;
      assert.deepEqual(await readAnswers(), { q1: 'A', q2: 'B' }, 'a newer client snapshot must be accepted');
      await sync(db, { q1: 'A' }, time(10_000));
      assert.deepEqual(await readAnswers(), { q1: 'A', q2: 'B' }, 'a delayed snapshot must not remove q2');
      await sync(db, {}, time(20_000));
      assert.deepEqual(await readAnswers(), { q1: 'A', q2: 'B' }, 'an equal-version conflict must not overwrite confirmed progress');
      const confirmed = (await db.query('select * from public.simulation_sessions')).rows;
      await sync(db, { q1: 'A', q2: 'B' }, time(20_000));
      assert.deepEqual((await db.query('select * from public.simulation_sessions')).rows, confirmed, 'exact retry does not change persistence time');
      for (const invalid of [null, 'infinity', '-infinity']) {
        await assert.rejects(db.query('select public.sync_simulation_session($1::uuid,$2,$3,$4::jsonb,$5::timestamptz,null,$6::timestamptz)',
          [A, session.id, session.status, JSON.stringify({ ...session, answers: {} }), created, invalid]), /simulation_invalid_version/);
      }
      // Existing app and site readers already use updated_at as their next cursor.
      const row = (await db.query<{ updated_at: Date; persisted_at: Date }>('select updated_at,persisted_at from public.simulation_sessions')).rows[0];
      assert.equal(row.updated_at.toISOString(), time(20_000));
      assert.ok(Math.abs(row.persisted_at.getTime() - Date.now()) < 30_000);
      const next = appTimestamp(row.updated_at.toISOString(), time(-60_000));
      assert.equal(next, siteTimestamp(row.updated_at.toISOString(), time(-60_000)));
      await sync(db, { q1: 'B', q2: 'B' }, next, { status: 'paused' });
      await db.exec('reset role');
      await db.exec("update public.subscriptions set status='expired'");
      await db.exec(`set role authenticated; set request.jwt.claim.sub='${A}'`);
      await sync(db, { q1: 'B', q2: 'B' }, time(30_000), { status: 'completed' });
      await sync(db, {}, time(25_000));
      assert.deepEqual(await readAnswers(), { q1: 'B', q2: 'B' });
      await assert.rejects(sync(db, {}, time(40_000)), /simulation_already_completed/);
    } finally { await db.close(); }
  });
}

test('simulado: migração recupera versões legadas e reaplicação/suspensão preservam histórico', async () => {
  const db = await setup();
  try {
    await studySetup(db, false);
    const versions = ['2090-01-01T00:00:00Z', '2001-01-01T00:00:00Z', 'invalid', 'infinity', null];
    for (const [index, version] of versions.entries()) {
      await sync(db, { q1: 'A', q2: 'B' }, new Date(Date.now() + index * 1000).toISOString(),
        { id: `legacy-${index}`, status: 'completed', updatedAt: version });
    }
    await db.exec('reset role');
    const before = (await db.query<{ session_id: string; payload: unknown; updated_at: Date }>(
      'select session_id,payload,updated_at from public.simulation_sessions order by session_id')).rows;
    await db.exec(await sql(versionMigration));
    const after = (await db.query<{ session_id: string; payload: unknown; updated_at: Date; persisted_at: Date }>(
      'select session_id,payload,updated_at,persisted_at from public.simulation_sessions order by session_id')).rows;
    for (const [index, row] of after.entries()) {
      assert.deepEqual(row.payload, before[index].payload);
      assert.equal(row.persisted_at.getTime(), before[index].updated_at.getTime());
      assert.equal(row.updated_at.getTime(), index < 2 ? Date.parse(versions[index]!) : before[index].updated_at.getTime());
    }
    const history = (await db.query('select * from public.simulation_sessions order by session_id')).rows;
    await db.exec(await sql(versionMigration));
    assert.deepEqual((await db.query('select * from public.simulation_sessions order by session_id')).rows, history);
    await db.exec('revoke execute on function public.sync_simulation_session(uuid,text,text,jsonb,timestamptz,timestamptz,timestamptz) from authenticated');
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${A}'`);
    await assert.rejects(sync(db, {}, new Date().toISOString()), /permission denied/);
    assert.deepEqual((await db.query('select * from public.simulation_sessions order by session_id')).rows, history);
    await db.exec('reset role');
    await db.exec(await sql(versionMigration));
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${A}'`);
    await sync(db, { q1: 'A' }, new Date().toISOString());
    assert.equal((await db.query('select session_id from public.simulation_sessions')).rows.length, 6);
  } finally { await db.close(); }
});

for (const currentProvider of ['google', 'mercado_pago']) {
  test(`Google: revalidar compra antiga suspensa preserva assinatura ${currentProvider} válida`, async () => {
    const db = await setup();
    const apply = async (token: string, state: string) => {
      await db.exec('set role service_role');
      const result = classifyGooglePurchase({ subscriptionState: state,
        lineItems: [{ productId: 'kad_diamond_monthly', expiryTime: '2099-01-01T00:00:00Z' }],
      }, 'kad_diamond_monthly');
      assert.ok(result.ok);
      return (await db.query<{ entitled: boolean }>(
        'select * from public.apply_google_play_purchase($1::uuid,$2,$3,null,$4,$5::timestamptz,$6,$7)',
        [A, token, 'kad_diamond_monthly', result.status, result.expiresAt, result.autoRenew, result.entitled])).rows[0];
    };
    try {
      await apply('fixture-old', 'SUBSCRIPTION_STATE_ACTIVE');
      await apply('fixture-current', 'SUBSCRIPTION_STATE_ACTIVE');
      await db.exec('reset role');
      await db.query('update public.subscriptions set provider=$1 where user_id=$2', [currentProvider, A]);
      const before = (await db.query('select * from public.subscriptions')).rows;
      for (const state of ['SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_PAUSED', 'unknown']) {
        assert.equal((await apply('fixture-old', state)).entitled, false);
        await db.exec('reset role');
        assert.deepEqual((await db.query('select * from public.subscriptions')).rows, before);
      }
      assert.equal((await db.query('select * from public.subscriptions')).rows.length, 1);
      assert.equal((await db.query('select * from public.google_play_purchases')).rows.length, 2);
    } finally { await db.close(); }
  });
}
