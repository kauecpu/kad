import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { paymentBootstrap } from './helpers/payment-database.ts';

test('abuse limiter: policies, quota, isolation, recovery, retention, privileges and migration replay', async () => {
  const db = new PGlite();
  const a = '10000000-0000-4000-8000-000000000001';
  const b = '10000000-0000-4000-8000-000000000002';
  const migration = await readFile(new URL('../supabase/migrations/20261008215543_abuse_protection.sql', import.meta.url), 'utf8');
  try {
    await db.exec(paymentBootstrap);
    await db.exec(migration);
    await db.query('insert into auth.users values ($1),($2)', [a, b]);
    const consume = (user: string, op = 'account_delete') => db.query<{ allowed: boolean; retry_after_seconds: number }>(
      'select * from public.consume_abuse_limit($1,$2)', [user, op]);
    for (let index = 0; index < 5; index++) assert.equal((await consume(a)).rows[0].allowed, true);
    const denied = (await consume(a)).rows[0];
    assert.equal(denied.allowed, false); assert.ok(denied.retry_after_seconds > 890 && denied.retry_after_seconds <= 900);
    assert.equal((await consume(b)).rows[0].allowed, true);
    assert.equal((await consume(a, 'subscription_cancel')).rows[0].allowed, true);
    await db.exec(migration);
    assert.equal((await consume(a)).rows[0].allowed, false, 'reapplying cannot reset quota');
    await db.query("update private.abuse_limit_counters set window_started_at=clock_timestamp()-interval '901 seconds' where user_id=$1", [a]);
    assert.equal((await consume(a)).rows[0].allowed, true);
    await assert.rejects(() => consume(a, 'unrestricted'), /no rows/);
    await assert.rejects(() => consume('10000000-0000-4000-8000-000000000009'), /foreign key/);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(() => consume(b), /permission denied/);
      await assert.rejects(() => db.exec('select * from private.abuse_limit_counters'), /permission denied/);
      await assert.rejects(() => db.exec('delete from private.abuse_limit_counters'), /permission denied/);
      await assert.rejects(() => db.exec('update private.abuse_limit_policies set max_attempts=1000'), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.equal((await consume(b)).rows[0].allowed, true);
    await db.exec('reset role');
    await db.query("update private.abuse_limit_counters set expires_at=clock_timestamp()-interval '1 second' where user_id=$1", [a]);
    await db.exec('select private.prune_abuse_limit_counters()');
    assert.equal((await db.query('select * from private.abuse_limit_counters where user_id=$1', [a])).rows.length, 0);
    assert.equal((await db.query('select * from private.abuse_limit_counters where user_id=$1', [b])).rows.length, 1);
    await db.query('delete from auth.users where id=$1', [b]);
    assert.equal((await db.query('select * from private.abuse_limit_counters')).rows.length, 0);
  } finally { await db.close(); }
});
