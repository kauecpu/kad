import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { paymentSetupSql, paymentFixtureSql } from './helpers/payment-database.ts';

test('new limiter preserves checkout 5/15m + 10s, reconciliation 10s and feedback 5/hour', async () => {
  const db = new PGlite();
  const a = '10000000-0000-4000-8000-000000000001';
  const b = '10000000-0000-4000-8000-000000000002';
  try {
    await db.exec(await paymentSetupSql()); await db.exec(paymentFixtureSql);
    for (const file of ['20260816010000_user_feedback_inbox.sql','20261008215543_abuse_protection.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
    }
    const now = Date.parse('2030-01-01T00:00:00Z');
    const time = (seconds:number) => new Date(now+seconds*1000).toISOString();
    const lease = (await db.query<{lease_token:string}>('select * from private.acquire_payment_checkout_lease($1,$2)',[a,time(0)])).rows[0].lease_token;
    const consume = async (seconds:number) => (await db.query<{allowed:boolean;retry_after_seconds:number}>(
      'select * from private.consume_payment_checkout_attempt($1,$2,$3)',[a,lease,time(seconds)])).rows[0];
    assert.equal((await consume(0)).allowed,true);
    assert.deepEqual(await consume(1),{allowed:false,retry_after_seconds:9});
    for (const seconds of [10,20,30,40]) assert.equal((await consume(seconds)).allowed,true);
    assert.deepEqual(await consume(50),{allowed:false,retry_after_seconds:850});
    const renewed = (await db.query<{lease_token:string}>('select * from private.acquire_payment_checkout_lease($1,$2)',[a,time(901)])).rows[0].lease_token;
    assert.equal((await db.query<{allowed:boolean}>('select * from private.consume_payment_checkout_attempt($1,$2,$3)',[a,renewed,time(901)])).rows[0].allowed,true);
    const reconcile = async () => (await db.query<{claimed:boolean}>('select * from public.claim_payment_checkout_reconciliation($1,$2)', ['20000000-0000-4000-8000-000000000001',a])).rows[0].claimed;
    assert.equal(await reconcile(),true); assert.equal(await reconcile(),false);
    await db.exec("update public.payment_checkout_sessions set last_reconciliation_at=clock_timestamp()-interval '11 seconds'");
    assert.equal(await reconcile(),true);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]); await db.exec('set role authenticated');
    const feedback = () => db.query("select public.submit_user_feedback('question','fixture feedback','test','web',null)");
    for (let i=0;i<5;i++) await feedback();
    await assert.rejects(feedback,/Feedback rate limit exceeded/);
    await assert.rejects(()=>db.exec("insert into public.user_feedback(user_id,category,message) values (auth.uid(),'question','bypass')"),/permission denied/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]); await feedback();
    await db.exec('reset role'); await db.query("update public.user_feedback set created_at=now()-interval '61 minutes' where user_id=$1",[a]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]); await db.exec('set role authenticated'); await feedback();
  } finally { await db.close(); }
});
