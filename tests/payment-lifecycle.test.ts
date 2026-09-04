import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { paymentSetupSql, paymentFixtureSql } from './helpers/payment-database.ts';

test('isolated PostgreSQL: leases, retry fencing, renewal, rejection, ordering, expiry and ownership', async () => {
  const db = new PGlite();
  try {
    await db.exec(await paymentSetupSql());
    await db.exec(paymentFixtureSql);
    const claim = async (key = 'synthetic-event') => (await db.query<{ outcome: string; token: string | null }>(
      'select * from public.claim_payment_webhook($1,$2,null,$3,true)',[key,'payment','synthetic-payment'])).rows[0];
    const finish = async (token: string | null, processed: boolean, error: string | null) => (await db.query<{ done: boolean }>(
      'select public.finish_payment_webhook($1,$2::uuid,$3::boolean,$4) as done',['synthetic-event',token,processed,error])).rows[0].done;
    const first = await claim(); assert.equal(first.outcome,'claimed');
    assert.equal((await claim()).outcome,'busy');
    assert.equal(await finish(first.token,false,'processing_failed'),true);
    const retry = await claim(); assert.equal(retry.outcome,'claimed'); assert.notEqual(first.token,retry.token);
    assert.equal(await finish(first.token,true,null),false,'stale worker cannot finish a newer attempt');
    assert.equal(await finish(retry.token,true,null),true);
    assert.equal((await claim()).outcome,'duplicate');
    assert.equal(await finish(retry.token,false,'processing_failed'),false,'completed event is immutable');
    const crashed = await claim('crashed'); assert.equal(crashed.outcome,'claimed');
    await db.exec("update public.payment_webhook_events set lease_expires_at=now()-interval '1 second' where provider_event_key='crashed'");
    assert.equal((await claim('crashed')).outcome,'claimed','expired lease is recoverable');
    await assert.rejects(db.exec("select * from public.claim_payment_webhook('synthetic-event','payment',null,'another-resource',true)"),/identity conflict/);

    const pay = (id: string,status: string,at: string,user = 1,amount = 1499,currency = 'BRL') => db.query(
      'select public.apply_mercado_pago_payment($1::uuid,$2,$3,$4,$5::integer,$6,$7::timestamptz,$7::timestamptz)',
      [`20000000-0000-4000-8000-00000000000${user}`,id,`synthetic-sub-${user}`,status,amount,currency,at]);
    const period = async () => (await db.query<{ ending: string; status: string }>(
      "select current_period_end::text ending,status from public.subscriptions where provider_subscription_id='synthetic-sub-1'")).rows[0];
    await pay('first','approved','2030-01-01T00:00:00Z');
    const firstPeriod = await period(); assert.match(firstPeriod.ending,/2030-02-01/);
    await pay('first','approved','2030-01-01T00:00:00Z'); assert.deepEqual(await period(),firstPeriod);
    await pay('renewal','pending','2030-02-01T00:00:00Z'); assert.deepEqual(await period(),firstPeriod);
    await pay('renewal','rejected','2030-02-02T00:00:00Z'); assert.equal((await period()).ending,firstPeriod.ending);
    await pay('renewal','approved','2030-02-03T00:00:00Z');
    const renewed = await period(); assert.match(renewed.ending,/2030-03-03/);
    await pay('renewal','rejected','2030-01-01T00:00:00Z'); assert.deepEqual(await period(),renewed);
    await pay('old-rejection','rejected','2030-01-02T00:00:00Z'); assert.deepEqual(await period(),renewed);
    await pay('renewal','approved','2030-02-03T00:00:00Z'); assert.deepEqual(await period(),renewed);
    await assert.rejects(pay('bad-price','approved','2030-03-01T00:00:00Z',1,1),/amount does not match/);
    await assert.rejects(pay('bad-currency','approved','2030-03-01T00:00:00Z',1,1499,'USD'),/amount does not match/);
    await assert.rejects(pay('first','approved','2030-03-01T00:00:00Z',2),/correlation failed/);
    await db.exec("select public.sync_mercado_pago_subscription('synthetic-sub-1','canceled','2030-02-04T00:00:00Z')");
    assert.equal((await period()).ending,renewed.ending); assert.equal((await period()).status,'canceled');
    await db.exec("select public.sync_mercado_pago_subscription('synthetic-sub-1','authorized','2030-02-01T00:00:00Z')");
    assert.equal((await period()).status,'canceled','old snapshot cannot undo cancellation');
    await assert.rejects(db.exec("select public.sync_mercado_pago_subscription('synthetic-sub-1','authorized','2030-02-04T00:00:00Z')"),/Conflicting/);
    await pay('late-distinct-payment','approved','2030-02-01T00:00:00Z');
    assert.equal((await period()).status,'canceled','late credit preserves newer cancellation');
    await pay('expired-fixture','approved','2000-01-01T00:00:00Z',2);
    await db.exec("set role authenticated; set request.jwt.claim.sub='10000000-0000-4000-8000-000000000002'");
    assert.equal((await db.query<{ status: string }>('select status from public.get_current_subscription()')).rows[0].status,'expired');
    assert.equal((await db.query('select * from public.get_current_subscription()')).rows.length,1);
    await assert.rejects(db.exec("select * from public.claim_payment_webhook('forged','payment',null,'fake',true)"),/permission denied/);
    await db.exec("set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'");
    assert.equal((await db.query<{ status: string }>('select status from public.get_current_subscription()')).rows[0].status,'canceled');
    await db.exec('set role anon'); await assert.rejects(db.exec('select * from public.get_current_subscription()'),/permission denied/);
  } finally { await db.close(); }
});
