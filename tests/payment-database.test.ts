import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL WASM regression; complements, not replaces, Supabase/pgTAP.
test('payment migrations preserve financial outcomes, ownership and idempotency in PostgreSQL', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema private;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as
        $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      create function private.set_updated_at() returns trigger language plpgsql as
        $$begin new.updated_at = now(); return new; end;$$;
      grant usage on schema public, auth to anon, authenticated, service_role;
    `);
    const migrations = [
      '202608110001_payments_subscriptions.sql',
      '20260812024756_harden_payment_subscriptions.sql',
      '20260812221545_grant_payment_edge_function_access.sql',
      '20260812225749_enforce_payment_edge_function_least_privilege.sql',
      '20260902040533_payment_checkout_diagnostics.sql',
      '20260902150000_payment_checkout_reconciliation.sql',
      '20260903014225_payment_atomic_status_reason.sql',
      '20260903043158_payment_legacy_terminal_compatibility.sql',
    ];
    for (const file of migrations) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    await db.exec(`
      insert into auth.users values
        ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
      insert into public.payment_checkout_sessions
        (id,user_id,plan,billing_cycle,provider,provider_subscription_id,amount_cents,status)
      values
        ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','diamond','monthly','mercado_pago','sub-a',1499,'pending'),
        ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','diamond','monthly','mercado_pago','sub-b',1499,'pending');
    `);
    const payment = (id: number, status: string, amount = 1499, currency = 'BRL', observed = 'now()') => db.query(
      `select public.apply_mercado_pago_payment($1::uuid,$2,$3,$4,$5::integer,$6,now(),${observed})`,
      [`20000000-0000-4000-8000-00000000000${id}`, `payment-${id}`, id === 1 ? 'sub-a' : 'sub-b', status, amount, currency]
    );
    const checkout = async () => (await db.query<{ status: string; status_reason: string | null }>(
      "select status,status_reason from public.payment_checkout_sessions where provider_subscription_id='sub-a'"
    )).rows[0];
    await assert.rejects(payment(1, 'approved', 1), /amount does not match/);
    await assert.rejects(payment(1, 'approved', 1499, 'USD'), /amount does not match/);
    await payment(1, 'approved');
    const firstPeriod = (await db.query("select current_period_end from public.subscriptions where provider_subscription_id='sub-a'")).rows;
    await payment(1, 'approved');
    assert.deepEqual((await db.query("select current_period_end from public.subscriptions where provider_subscription_id='sub-a'")).rows, firstPeriod);
    await payment(1, 'rejected', 1499, 'BRL', "now() - interval '1 day'");
    assert.deepEqual(await checkout(), { status: 'approved', status_reason: null });
    await db.exec("select public.sync_mercado_pago_subscription('sub-a','canceled')");
    assert.deepEqual(await checkout(), { status: 'approved', status_reason: null });
    assert.deepEqual((await db.query("select current_period_end from public.subscriptions where provider_subscription_id='sub-a'")).rows, firstPeriod);
    await payment(1, 'refunded');
    await payment(1, 'approved');
    await db.exec("select public.sync_mercado_pago_subscription('sub-a','pending')");
    assert.deepEqual(await checkout(), { status: 'canceled', status_reason: 'payment_refunded' });
    const financialBefore = (await db.query('select provider_payment_id,credit_applied_at,terminal_status from public.payment_transactions order by provider_payment_id')).rows;
    await db.exec(await readFile(new URL('../supabase/migrations/20260903043158_payment_legacy_terminal_compatibility.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await db.query('select provider_payment_id,credit_applied_at,terminal_status from public.payment_transactions order by provider_payment_id')).rows, financialBefore);
    await payment(2, 'approved');
    await payment(2, 'charged_back');
    await payment(2, 'approved');
    await db.exec("select public.sync_mercado_pago_subscription('sub-b','canceled')");
    assert.equal((await db.query<{ status_reason: string }>("select status_reason from public.payment_checkout_sessions where provider_subscription_id='sub-b'")).rows[0].status_reason, 'payment_chargeback');
    // Legacy rows had terminal transactions but no user-facing reason.
    // Reapply only inside this disposable database to exercise migration backfill.
    await db.exec("update public.payment_checkout_sessions set status_reason=null, status='pending' where provider_subscription_id='sub-b'");
    await db.exec(await readFile(new URL('../supabase/migrations/20260903043158_payment_legacy_terminal_compatibility.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await db.query("select status,status_reason from public.payment_checkout_sessions where provider_subscription_id='sub-b'")).rows[0],
      { status: 'canceled', status_reason: 'payment_chargeback' });
    await db.exec("update public.payment_checkout_sessions set status_reason=null where provider_subscription_id='sub-a'");
    await db.exec("select public.sync_mercado_pago_subscription('sub-a','pending')");
    assert.deepEqual(await checkout(), { status: 'canceled', status_reason: 'payment_refunded' });
    await db.exec(`select public.apply_mercado_pago_payment(
      '20000000-0000-4000-8000-000000000001','new-payment','sub-a','approved',1499,'BRL',now(),now())`);
    assert.deepEqual(await checkout(), { status: 'approved', status_reason: null });
    await db.exec("update public.payment_checkout_sessions set status='pending',status_reason=null where provider_subscription_id='sub-a'");
    assert.equal((await db.query<{ reason: string | null }>("select private.legacy_mercado_pago_checkout_reason('20000000-0000-4000-8000-000000000001') as reason")).rows[0].reason, null,
      'compatibility never invents a reversal when another credit remains valid');
    await db.exec("set role authenticated; set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'");
    assert.equal((await db.query('select user_id from public.subscriptions')).rows.length, 1);
    assert.equal((await db.query("select * from public.get_payment_checkout_status('20000000-0000-4000-8000-000000000001')")).rows.length, 1);
    assert.equal((await db.query("select * from public.get_payment_checkout_status('20000000-0000-4000-8000-000000000002')")).rows.length, 0);
    await assert.rejects(db.exec("update public.subscriptions set status='active'"), /permission denied/);
    await assert.rejects(payment(1, 'approved'), /permission denied/);
    await assert.rejects(db.query('select * from public.payment_checkout_sessions'), /permission denied/);
    await db.exec('set role anon');
    await assert.rejects(db.query("select * from public.get_payment_checkout_status('20000000-0000-4000-8000-000000000001')"), /permission denied/);
  } finally {
    await db.close();
  }
});
