import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

export const paymentBootstrap = `
  set timezone = 'UTC';
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema private;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as
    $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
  create function private.set_updated_at() returns trigger language plpgsql as
    $$begin new.updated_at = now(); return new; end;$$;
  grant usage on schema public, auth to anon, authenticated, service_role;
`;

export const paymentMigrations = [
  '202608110001_payments_subscriptions.sql',
  '20260812024756_harden_payment_subscriptions.sql',
  '20260812221545_grant_payment_edge_function_access.sql',
  '20260812225749_enforce_payment_edge_function_least_privilege.sql',
  '20260902040533_payment_checkout_diagnostics.sql',
  '20260902150000_payment_checkout_reconciliation.sql',
  '20260903014225_payment_atomic_status_reason.sql',
  '20260903043158_payment_legacy_terminal_compatibility.sql',
  '20260903220504_payment_webhook_claims.sql',
  '20260903220508_payment_lifecycle_ordering.sql',
  '20260903220512_subscription_observed_state.sql',
];

export async function paymentSetupSql(): Promise<string> {
  const sql = await Promise.all(paymentMigrations.map((file) => readFile(
    new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8')));
  return paymentBootstrap + sql.join('\n');
}

export const paymentFixtureSql = `
  insert into auth.users values
    ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
  insert into public.payment_checkout_sessions
    (id,user_id,plan,billing_cycle,provider,provider_subscription_id,amount_cents,status)
  values
    ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','diamond','monthly','mercado_pago','synthetic-sub-1',1499,'pending'),
    ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','diamond','monthly','mercado_pago','synthetic-sub-2',1499,'pending');
`;
