import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { paymentSetupSql, paymentFixtureSql } from './helpers/payment-database.ts';
import { classifyGooglePurchase } from '../supabase/functions/_shared/google-play.ts';

const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const migration = '20261008003639_enforce_simulation_entitlements.sql';
const syncMigration = '20261009231430_preserve_simulation_sync_version.sql';
const sql = (file: string) => readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');

test('simulado: autorização server-side, transição segura, retomada e isolamento', async () => {
  const db = new PGlite();
  const created = '2026-01-01T00:00:00Z';
  let tick = 0;
  const payload = (id: string, status = 'active') => ({ id, status, createdAt: created,
    config: { questionCount: 1 }, questions: [{ questionId: 'fixture-1', alternativeOrder: ['A', 'B'] }],
    answers: {}, remainingSeconds: 300 });
  const sync = (id: string, p = payload(id), owner = A) => db.query(
    'select public.sync_simulation_session($1::uuid,$2,$3,$4::jsonb,$5::timestamptz,$6::timestamptz,$7::timestamptz)',
    [owner, id, p.status, JSON.stringify(p), created, p.status === 'completed' ? created : null,
      new Date(Date.now() + ++tick * 1000).toISOString()]);
  const asUser = (owner = A) => db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}'`);
  const setPlan = async (status: string, period = "now() + interval '1 day'", plan = 'diamond') => {
    await db.exec('reset role');
    await db.query(`insert into public.subscriptions (user_id,plan,billing_cycle,provider,provider_subscription_id,provider_status,status,started_at,current_period_end)
      values ($1,$2,'monthly','mercado_pago','fixture-entitlement',$3,$3,now()-interval '1 day',${period})
      on conflict(user_id) do update set status=excluded.status,plan=excluded.plan,current_period_end=excluded.current_period_end`, [A,plan,status]);
    await asUser();
  };
  try {
    await db.exec(await paymentSetupSql());
    await db.exec(paymentFixtureSql);
    await db.exec(await sql('202608300001_google_play_billing.sql'));
    await db.exec(`create table public.profiles(id uuid primary key); create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text);
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
    await db.exec(await sql('20260816030000_sync_user_study_data.sql'));
    await asUser();
    await sync('legacy'); // Existing data must survive migration.
    await db.exec('reset role');
    const legacyColumns = 'user_id, session_id, status, payload, created_at, completed_at, updated_at';
    const before = (await db.query(`select ${legacyColumns} from public.simulation_sessions`)).rows;
    // A deployment may already have the newer abuse migration. Applying this
    // previously pending migration must not reset quotas or broaden its grants.
    const abuse = await sql('20261008215543_abuse_protection.sql');
    await db.exec(abuse);
    await db.exec('set role service_role');
    const consume = () => db.query<{ allowed: boolean }>(
      'select * from public.consume_abuse_limit($1,$2)', [A, 'account_delete']);
    for (let i = 0; i < 5; i++) assert.equal((await consume()).rows[0].allowed, true);
    assert.equal((await consume()).rows[0].allowed, false);
    await db.exec('reset role');
    const quotaBefore = (await db.query('select * from private.abuse_limit_counters')).rows;
    await db.exec(await sql(migration));
    await db.exec(await sql(migration)); // Rerunnable, no duplicate/history loss.
    await db.exec(await sql(syncMigration));
    assert.deepEqual((await db.query(`select ${legacyColumns} from public.simulation_sessions`)).rows, before);
    assert.deepEqual((await db.query('select * from private.abuse_limit_counters')).rows, quotaBefore);
    await db.exec(abuse); // Also prove the newer migration can follow this one.
    await db.exec('set role service_role');
    assert.equal((await consume()).rows[0].allowed, false);
    await db.exec('reset role');
    await asUser();
    await assert.rejects(consume(), /permission denied/);
    await assert.rejects(sync('free-pending'), /subscription_required/);
    assert.equal((await db.query('select session_id from public.simulation_sessions')).rows.length, 1);
    for (const status of ['expired', 'canceled', 'active', 'past_due']) {
      await setPlan(status, "now()-interval '1 second'");
      await assert.rejects(sync(`expired-${status}`), /subscription_required/);
    }
    await setPlan('expired'); // Future timestamp alone cannot authorize an expired status.
    await assert.rejects(sync('future-expired'), /subscription_required/);
    for (const [plan,status] of [['platinum','active'],['diamond','past_due'],['circle','canceled']]) {
      await setPlan(status, "now()+interval '1 day'", plan);
      await sync(`${plan}-${status}`, payload(`${plan}-${status}`, 'completed'));
    }
    await setPlan('active');
    await sync('paid');
    await setPlan('expired', "now()-interval '1 second'");
    await sync('paid', { ...payload('paid', 'paused'), remainingSeconds: 240 });
    await sync('paid', { ...payload('paid'), remainingSeconds: 200 });
    await assert.rejects(sync('paid', { ...payload('paid'), questions: [{ questionId: 'different', alternativeOrder: ['A','B'] }] }), /simulation_snapshot_immutable/);
    await assert.rejects(sync('paid', { ...payload('paid'), config: { questionCount: 2 } }), /simulation_snapshot_immutable/);
    await assert.rejects(sync('paid', { ...payload('paid'), createdAt: '2026-02-01' }), /simulation_snapshot_immutable/);
    await sync('paid', { ...payload('paid','completed'), remainingSeconds: 0 });
    await sync('paid', { ...payload('paid','completed'), remainingSeconds: 0 });
    const confirmed = (await db.query("select * from public.simulation_sessions where session_id='paid'")).rows;
    await db.query('select public.sync_simulation_session($1::uuid,$2,$3,$4::jsonb,$5::timestamptz,null,$6::timestamptz)',
      [A,'paid','active',JSON.stringify(payload('paid')),created,'1900-01-01']);
    assert.deepEqual((await db.query("select * from public.simulation_sessions where session_id='paid'")).rows, confirmed);
    await assert.rejects(sync('paid'), /simulation_already_completed/);
    await assert.rejects(sync('paid', { ...payload('paid','completed'), id: 'another-id' }), /simulation_identity_mismatch/);
    await assert.rejects(db.query('select public.sync_simulation_session($1::uuid,$2,$3,$4::jsonb,$5::timestamptz,$5::timestamptz,now())',
      [A,'paid','completed',JSON.stringify(payload('paid','active')),created]), /simulation_identity_mismatch/);
    await assert.rejects(sync('new-after-expiry'), /subscription_required/);
    await assert.rejects(db.exec("insert into public.simulation_sessions select * from public.simulation_sessions"), /permission denied/);
    await assert.rejects(sync('someone-else', payload('someone-else'), B), /Authentication required/);
    await assert.rejects(db.query('select public.sync_simulation_session(null,$1,$2,$3::jsonb,now(),null,now())',
      ['null-owner','active',JSON.stringify(payload('null-owner'))]), /Authentication required/);
    await asUser(B);
    assert.equal((await db.query('select * from public.simulation_sessions')).rows.length, 0);
    assert.equal((await db.query('delete from public.simulation_sessions returning session_id')).rows.length, 0);
    await assert.rejects(sync('paid'), /Authentication required/);
    await db.exec('set role anon');
    await assert.rejects(sync('guest'), /permission denied/);
    await db.exec("set role authenticated; set request.jwt.claim.sub=''");
    await assert.rejects(sync('no-identity'), /Authentication required/);

    // Emergency rollback stops RPC writes without removing the owner's history.
    await db.exec('reset role');
    const history = (await db.query('select * from public.simulation_sessions order by session_id')).rows;
    await db.exec('revoke execute on function public.sync_simulation_session(uuid,text,text,jsonb,timestamptz,timestamptz,timestamptz) from public,anon,authenticated');
    await asUser();
    await assert.rejects(sync('paid', payload('paid','completed')), /permission denied/);
    assert.deepEqual((await db.query('select * from public.simulation_sessions order by session_id')).rows, history);
    await db.exec('reset role');
    await db.exec(await sql(migration));
    await db.exec(await sql(syncMigration));
    await asUser();
    await sync('paid', payload('paid','completed'));
  } finally { await db.close(); }
});

test('Google suspenso revoga no banco o acesso previamente concedido, sem duplicar assinatura', async () => {
  const db = new PGlite();
  try {
    await db.exec(await paymentSetupSql());
    await db.exec(paymentFixtureSql);
    await db.exec(await sql('202608300001_google_play_billing.sql'));
    await db.exec(await sql('20261009210911_google_play_entitlement_revalidation.sql'));
    await db.exec('set role service_role');
    for (const state of ['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PAUSED','unknown']) {
      const result = classifyGooglePurchase({ subscriptionState: state,
        lineItems: [{ productId: 'kad_diamond_monthly', expiryTime: '2099-01-01T00:00:00Z' }],
      }, 'kad_diamond_monthly');
      assert.ok(result.ok);
      const applied = (await db.query<{ entitled: boolean; subscription_status: string }>(
        'select * from public.apply_google_play_purchase($1::uuid,$2,$3,null,$4,$5::timestamptz,$6,$7)',
        [A,'fixture-google-purchase','kad_diamond_monthly',result.status,result.expiresAt,result.autoRenew,result.entitled])).rows[0];
      assert.equal(applied.entitled, state === 'SUBSCRIPTION_STATE_ACTIVE');
      assert.equal(applied.subscription_status, state === 'SUBSCRIPTION_STATE_ACTIVE' ? 'active' : 'expired');
    }
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${A}'`);
    assert.equal((await db.query<{status: string}>('select status from public.get_current_subscription()')).rows[0].status, 'expired');
    assert.equal((await db.query('select user_id from public.subscriptions')).rows.length, 1);
  } finally { await db.close(); }
});
