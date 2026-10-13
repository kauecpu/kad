import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { paymentSetupSql, paymentFixtureSql } from './helpers/payment-database.ts';

const migrationUrl = new URL('../supabase/migrations/20261009210911_google_play_entitlement_revalidation.sql', import.meta.url);
const a = '10000000-0000-4000-8000-000000000001';
const b = '10000000-0000-4000-8000-000000000002';

test('Google persistence: revocation, other entitlements, ownership, replay and privileges', async () => {
  const db = new PGlite();
  const apply = async (token: string, status = 'active', entitled = true, user = a,
    product = 'kad_diamond_monthly', expiry: string | null = '2099-01-01T00:00:00Z') =>
    (await db.query<{ entitled: boolean; subscription_status: string }>(
      'select * from public.apply_google_play_purchase($1,$2,$3,$4,$5,$6,$7,$8)',
      [user, token, product, 'fixture-order', status, expiry, true, entitled])).rows[0];
  const subscription = async () => (await db.query<{ status: string; provider_subscription_id: string; provider: string }>(
    'select * from public.subscriptions where user_id=$1', [a])).rows[0];
  try {
    await db.exec(await paymentSetupSql());
    await db.exec(paymentFixtureSql);
    await db.exec(await readFile(new URL('../supabase/migrations/202608300001_google_play_billing.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(migrationUrl, 'utf8'));
    await db.exec('set role service_role');
    assert.equal((await apply('fixture-old')).entitled, true);
    // A legacy handler must not grant past_due access even if it sends true.
    assert.equal((await apply('fixture-old', 'past_due', true)).entitled, false);
    await db.exec('reset role');
    assert.equal((await subscription()).status, 'expired');
    await apply('fixture-old', 'active', true);
    await apply('fixture-new');
    await apply('fixture-old', 'past_due', false);
    assert.equal((await subscription()).provider_subscription_id, 'fixture-new');
    assert.equal((await subscription()).status, 'active');
    await apply('fixture-old');
    await apply('fixture-old', 'expired', false);
    assert.equal((await subscription()).provider_subscription_id, 'fixture-new', 'another verified valid token remains usable');
    await apply('fixture-new', 'expired', false);
    assert.equal((await subscription()).status, 'expired');
    await apply('fixture-new', 'expired', false);
    assert.equal((await db.query('select * from public.subscriptions')).rows.length, 1);
    assert.equal((await db.query('select * from public.google_play_purchases')).rows.length, 2);
    await assert.rejects(() => apply('fixture-new', 'active', true, b), /another account/);
    await assert.rejects(() => apply('fixture-new', 'active', true, a, 'kad_platinum_monthly'), /another account/);
    await assert.rejects(() => apply('fixture-invalid', 'active', true, a, 'constructor'), /Invalid/);
    assert.equal((await apply('fixture-new', 'active', true, a, 'kad_diamond_monthly', '2000-01-01T00:00:00Z')).entitled, false);
    assert.equal((await apply('fixture-new', 'canceled', true)).entitled, true);
    await db.exec("update public.subscriptions set provider='mercado_pago', provider_subscription_id='fixture-mp', status='active'");
    await apply('fixture-new', 'past_due', false);
    assert.equal((await subscription()).provider, 'mercado_pago');
    assert.equal((await subscription()).status, 'active');
    const before = JSON.stringify((await db.query('select * from public.subscriptions')).rows);
    await db.exec(await readFile(migrationUrl, 'utf8'));
    assert.equal(JSON.stringify((await db.query('select * from public.subscriptions')).rows), before);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(() => apply('fixture-denied'), /permission denied/);
      await assert.rejects(() => db.exec('select * from public.google_play_purchases'), /permission denied/);
      await assert.rejects(() => db.exec("update public.subscriptions set status='active'"), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${b}',false)`);
    assert.equal((await db.query('select status from public.subscriptions')).rows.length, 0);
  } finally { await db.close(); }
});
