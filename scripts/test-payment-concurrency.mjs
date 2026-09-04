// Dedicated disposable localhost PostgreSQL only. Never point this at Supabase.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { paymentSetupSql,paymentFixtureSql } from '../tests/helpers/payment-database.ts';

if (!['localhost','127.0.0.1'].includes(process.env.PGHOST)
  || process.env.PGDATABASE !== 'kad_payment_test') throw new Error('Requires disposable localhost kad_payment_test database');

function query(sql,onLocked) {
  return new Promise((resolve,reject) => {
    const child = spawn('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{ env: process.env,stdio:['pipe','pipe','pipe'] });
    let output = ''; let error = ''; let announced = false;
    child.stdout.on('data',(data) => {
      output += data;
      if (!announced && output.includes('LOCKED')) { announced = true; onLocked?.(); }
    });
    child.stderr.on('data',(data) => { error += data; });
    child.on('error',reject);
    child.on('close',(code) => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
    child.stdin.end(sql);
  });
}

await query(await paymentSetupSql());
await query(paymentFixtureSql);
const paymentSql = `select public.apply_mercado_pago_payment(
 '20000000-0000-4000-8000-000000000001','concurrent-payment','synthetic-sub-1',
 'approved',1499,'BRL','2030-01-01T00:00:00Z','2030-01-01T00:00:00Z');`;
let release;
const locked = new Promise((resolve) => { release = resolve; });
const leader = query(`begin; ${paymentSql} select 'LOCKED'; select pg_sleep(2); commit;`,release);
await Promise.race([locked,leader.then(() => { throw new Error('Leader did not acquire lock'); })]);
await Promise.all([leader,...Array.from({ length: 12 },() => query(paymentSql))]);
assert.equal(await query("select count(*) from public.payment_transactions"),'1');
assert.equal(await query("select to_char(current_period_end at time zone 'UTC','YYYY-MM-DD') from public.subscriptions"),'2030-02-01');

const claimSql = "select outcome from public.claim_payment_webhook('concurrent-event','payment',null,'concurrent-payment',true);";
let releaseClaim;
const claimLocked = new Promise((resolve) => { releaseClaim = resolve; });
const claimant = query(`begin; ${claimSql} select 'LOCKED'; select pg_sleep(2); commit;`,releaseClaim);
await Promise.race([claimLocked,claimant.then(() => { throw new Error('Claim leader did not acquire lock'); })]);
const outcomes = await Promise.all(Array.from({ length: 12 },() => query(claimSql)));
await claimant;
assert.ok(outcomes.every((result) => result === 'busy'));
assert.equal(await query("select attempts from public.payment_webhook_events where provider_event_key='concurrent-event'"),'1');
console.log('PostgreSQL multi-session: 13 concurrent payments = 1 credit; 13 claims = 1 owner.');
