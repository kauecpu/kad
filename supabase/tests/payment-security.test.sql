begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(71);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'payment-a@test.invalid', '{"username":"pay_test_a"}'::jsonb),
  ('10000000-0000-4000-8000-000000000002', 'payment-b@test.invalid', '{"username":"pay_test_b"}'::jsonb),
  ('10000000-0000-4000-8000-000000000003', 'payment-c@test.invalid', '{"username":"pay_test_c"}'::jsonb),
  ('10000000-0000-4000-8000-000000000004', 'payment-d@test.invalid', '{"username":"pay_test_d"}'::jsonb),
  ('10000000-0000-4000-8000-000000000005', 'payment-e@test.invalid', '{"username":"pay_test_e"}'::jsonb),
  ('10000000-0000-4000-8000-000000000006', 'limiter-a@test.invalid', '{"username":"limit_test_a"}'::jsonb),
  ('10000000-0000-4000-8000-000000000007', 'limiter-b@test.invalid', '{"username":"limit_test_b"}'::jsonb),
  ('10000000-0000-4000-8000-000000000008', 'payment-old-refund@test.invalid', '{"username":"pay_old_refund"}'::jsonb),
  ('10000000-0000-4000-8000-000000000009', 'payment-old-chargeback@test.invalid', '{"username":"pay_old_chargeback"}'::jsonb);

insert into public.payment_checkout_sessions (
  id,
  user_id,
  plan,
  billing_cycle,
  provider,
  provider_subscription_id,
  amount_cents,
  currency,
  status,
  expires_at
)
select
  ('20000000-0000-4000-8000-00000000000' || test_case)::uuid,
  ('10000000-0000-4000-8000-00000000000' || test_case)::uuid,
  'diamond',
  'monthly',
  'mercado_pago',
  'subscription-' || test_case,
  1499,
  'BRL',
  'pending',
  (transaction_timestamp() + interval '30 days')
from generate_series(1, 5) as cases(test_case);

insert into public.payment_checkout_sessions (
  id,
  user_id,
  plan,
  billing_cycle,
  provider,
  provider_subscription_id,
  amount_cents,
  currency,
  status,
  expires_at
)
select
  ('20000000-0000-4000-8000-00000000000' || test_case)::uuid,
  ('10000000-0000-4000-8000-00000000000' || test_case)::uuid,
  'diamond',
  'monthly',
  'mercado_pago',
  'subscription-' || test_case,
  1499,
  'BRL',
  'pending',
  (transaction_timestamp() + interval '30 days')
from (values (8), (9)) as cases(test_case);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_payment_checkout_reconciliation(uuid,uuid)',
    'EXECUTE'
  ),
  'anon cannot claim provider reconciliation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_payment_checkout_reconciliation(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot bypass reconciliation rate limits'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_payment_checkout_reconciliation(uuid,uuid)',
    'EXECUTE'
  ),
  'service_role can claim provider reconciliation'
);
select ok(
  (
    select claim.claimed
    from public.claim_payment_checkout_reconciliation(
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001'
    ) as claim
  ),
  'first provider reconciliation is claimed'
);
select ok(
  (
    select not claim.claimed and claim.retry_after_seconds >= 1
    from public.claim_payment_checkout_reconciliation(
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001'
    ) as claim
  ),
  'immediate duplicate reconciliation is rate limited'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.apply_mercado_pago_payment(uuid,text,text,text,integer,text,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'anon cannot execute the payment reconciliation RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_mercado_pago_payment(uuid,text,text,text,integer,text,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'authenticated cannot execute the payment reconciliation RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.apply_mercado_pago_payment(uuid,text,text,text,integer,text,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'service_role can execute the payment reconciliation RPC'
);

select ok(
  has_table_privilege('service_role', 'public.payment_checkout_sessions', 'SELECT'),
  'service_role can read checkout sessions for payment Edge Functions'
);
select ok(
  has_table_privilege('service_role', 'public.payment_checkout_sessions', 'INSERT'),
  'service_role can create checkout sessions for payment Edge Functions'
);
select ok(
  has_table_privilege('service_role', 'public.payment_checkout_sessions', 'UPDATE'),
  'service_role can update checkout sessions for payment Edge Functions'
);
select ok(
  not has_table_privilege(
    'service_role',
    'public.payment_checkout_sessions',
    'DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ),
  'service_role has no excess checkout-session privileges'
);
select ok(
  has_table_privilege('service_role', 'public.subscriptions', 'SELECT'),
  'service_role can read subscriptions for checkout and cancellation'
);
select ok(
  not has_table_privilege(
    'service_role',
    'public.subscriptions',
    'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ),
  'service_role must change subscriptions through hardened RPCs'
);
select ok(
  has_table_privilege('service_role', 'public.payment_webhook_events', 'SELECT'),
  'service_role can read signed webhook events'
);
select ok(
  has_table_privilege('service_role', 'public.payment_webhook_events', 'INSERT'),
  'service_role can record signed webhook events'
);
select ok(
  has_table_privilege('service_role', 'public.payment_webhook_events', 'UPDATE'),
  'service_role can mark signed webhook events as processed'
);
select ok(
  not has_table_privilege(
    'service_role',
    'public.payment_webhook_events',
    'DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ),
  'service_role has no excess webhook-event privileges'
);
select ok(
  not has_table_privilege(
    'service_role',
    'public.payment_transactions',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ),
  'service_role has no direct payment-transaction privileges'
);

create temporary table checkout_limit_results (
  label text primary key,
  lease_token uuid,
  retry_after_seconds integer,
  allowed boolean
);

insert into checkout_limit_results (label, lease_token, retry_after_seconds)
select 'first-lease', lease_token, retry_after_seconds
from private.acquire_payment_checkout_lease(
  '10000000-0000-4000-8000-000000000006',
  '2026-08-12T02:00:00Z'
);
insert into checkout_limit_results (label, lease_token, retry_after_seconds)
select 'concurrent-lease', lease_token, retry_after_seconds
from private.acquire_payment_checkout_lease(
  '10000000-0000-4000-8000-000000000006',
  '2026-08-12T02:00:01Z'
);

select ok(
  (select lease_token is not null from checkout_limit_results where label = 'first-lease'),
  'first checkout request acquires the PostgreSQL lease'
);
select ok(
  (select lease_token is null from checkout_limit_results where label = 'concurrent-lease'),
  'a concurrent checkout request cannot acquire the same user lease'
);
select cmp_ok(
  (select retry_after_seconds from checkout_limit_results where label = 'concurrent-lease'),
  '>=',
  1,
  'concurrent checkout receives a retry delay'
);

select private.release_payment_checkout_lease(
  '10000000-0000-4000-8000-000000000006',
  (select lease_token from checkout_limit_results where label = 'first-lease')
);

insert into checkout_limit_results (label, lease_token, retry_after_seconds)
select 'first-attempt', lease_token, retry_after_seconds
from private.acquire_payment_checkout_lease(
  '10000000-0000-4000-8000-000000000006',
  '2026-08-12T02:00:02Z'
);
update checkout_limit_results as result
set allowed = attempt.allowed,
    retry_after_seconds = attempt.retry_after_seconds
from private.consume_payment_checkout_attempt(
  '10000000-0000-4000-8000-000000000006',
  (
    select lease_token
    from checkout_limit_results
    where label = 'first-attempt'
  ),
  '2026-08-12T02:00:02Z'
) as attempt
where result.label = 'first-attempt';
select private.release_payment_checkout_lease(
  '10000000-0000-4000-8000-000000000006',
  (select lease_token from checkout_limit_results where label = 'first-attempt')
);

insert into checkout_limit_results (label, lease_token, retry_after_seconds)
select 'cooldown-attempt', lease_token, retry_after_seconds
from private.acquire_payment_checkout_lease(
  '10000000-0000-4000-8000-000000000006',
  '2026-08-12T02:00:07Z'
);
update checkout_limit_results as result
set allowed = attempt.allowed,
    retry_after_seconds = attempt.retry_after_seconds
from private.consume_payment_checkout_attempt(
  '10000000-0000-4000-8000-000000000006',
  (
    select lease_token
    from checkout_limit_results
    where label = 'cooldown-attempt'
  ),
  '2026-08-12T02:00:07Z'
) as attempt
where result.label = 'cooldown-attempt';

select ok(
  (select allowed from checkout_limit_results where label = 'first-attempt'),
  'first provider checkout attempt is allowed'
);
select ok(
  not (select allowed from checkout_limit_results where label = 'cooldown-attempt'),
  'checkout attempt inside the cooldown is denied'
);
select is(
  (select retry_after_seconds from checkout_limit_results where label = 'cooldown-attempt'),
  5,
  'cooldown returns the exact Retry-After delay'
);

create temporary table checkout_window_results (
  attempt_number integer primary key,
  allowed boolean,
  retry_after_seconds integer
);

do $$
declare
  attempt_number integer;
  attempt_time timestamptz;
  acquired_lease uuid;
  attempt_allowed boolean;
  attempt_retry integer;
begin
  for attempt_number in 1..6 loop
    attempt_time := '2026-08-12T03:00:00Z'::timestamptz
      + ((attempt_number - 1) * interval '11 seconds');
    select lease.lease_token
    into acquired_lease
    from private.acquire_payment_checkout_lease(
      '10000000-0000-4000-8000-000000000007',
      attempt_time
    ) as lease;
    select attempt.allowed, attempt.retry_after_seconds
    into attempt_allowed, attempt_retry
    from private.consume_payment_checkout_attempt(
      '10000000-0000-4000-8000-000000000007',
      acquired_lease,
      attempt_time
    ) as attempt;
    insert into checkout_window_results
    values (attempt_number, attempt_allowed, attempt_retry);
    perform private.release_payment_checkout_lease(
      '10000000-0000-4000-8000-000000000007',
      acquired_lease
    );
  end loop;
end;
$$;

select is(
  (select count(*)::integer from checkout_window_results where allowed),
  5,
  'five checkout creations are allowed inside the rolling window'
);
select ok(
  not (select allowed from checkout_window_results where attempt_number = 6),
  'the sixth checkout creation is denied'
);
select is(
  (
    select attempt_count
    from private.payment_checkout_rate_limits
    where user_id = '10000000-0000-4000-8000-000000000007'
  ),
  5,
  'denied attempts do not increment the provider-call counter'
);

select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000001',
  'payment-a', 'subscription-1', 'approved', 1499, 'BRL',
  (transaction_timestamp() - interval '2 days' + interval '0 minutes'), (transaction_timestamp() - interval '2 days' + interval '1 minutes')
);
create temporary table original_periods as
select user_id, current_period_end
from public.subscriptions;
select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000001',
  'payment-a', 'subscription-1', 'approved', 1499, 'BRL',
  (transaction_timestamp() - interval '2 days' + interval '0 minutes'), (transaction_timestamp() - interval '2 days' + interval '2 minutes')
);
select is(
  (select current_period_end from public.subscriptions where user_id = '10000000-0000-4000-8000-000000000001'),
  (select current_period_end from original_periods where user_id = '10000000-0000-4000-8000-000000000001'),
  'approved to approved does not grant a second period'
);
select ok(
  (select credit_applied_at is not null from public.payment_transactions where provider_payment_id = 'payment-a'),
  'approved payment records its immutable credit marker'
);
select public.sync_mercado_pago_subscription('subscription-1', 'canceled');
select is(
  (select status from public.payment_checkout_sessions where id = '20000000-0000-4000-8000-000000000001'),
  'approved',
  'canceling renewal does not rewrite an approved checkout'
);
select is(
  (select status from public.subscriptions where user_id = '10000000-0000-4000-8000-000000000001'),
  'canceled',
  'canceling renewal marks the subscription without revoking paid access'
);
select is(
  (select current_period_end from public.subscriptions where user_id = '10000000-0000-4000-8000-000000000001'),
  (select current_period_end from original_periods where user_id = '10000000-0000-4000-8000-000000000001'),
  'canceling renewal preserves the paid period end'
);

select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000002',
  'payment-b', 'subscription-2', 'approved', 1499, 'BRL',
  (transaction_timestamp() - interval '2 days' + interval '0 minutes'), (transaction_timestamp() - interval '2 days' + interval '1 minutes')
);
select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000002',
  'payment-b', 'subscription-2', 'refunded', 1499, 'BRL',
  (transaction_timestamp() - interval '2 days' + interval '0 minutes'), (transaction_timestamp() - interval '1 days' + interval '1 minutes')
);
select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000002',
  'payment-b', 'subscription-2', 'approved', 1499, 'BRL',
  (transaction_timestamp() - interval '2 days' + interval '0 minutes'), (transaction_timestamp() - interval '0 days' + interval '1 minutes')
);
select is(
  (select terminal_status from public.payment_transactions where provider_payment_id = 'payment-b'),
  'refunded',
  'approved to refunded to approved preserves the terminal refund'
);
select is(
  (select status from public.subscriptions where user_id = '10000000-0000-4000-8000-000000000002'),
  'expired',
  'refund expires the subscription'
);
select cmp_ok(
  (select current_period_end from public.subscriptions where user_id = '10000000-0000-4000-8000-000000000002'),
  '<=',
  transaction_timestamp(),
  'refund removes remaining access immediately'
);

select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000003',
  'payment-c', 'subscription-3', 'approved', 1499, 'BRL',
  (transaction_timestamp() - interval '2 days' + interval '0 minutes'), (transaction_timestamp() - interval '2 days' + interval '1 minutes')
);
select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000003',
  'payment-c', 'subscription-3', 'charged_back', 1499, 'BRL',
  (transaction_timestamp() - interval '2 days' + interval '0 minutes'), (transaction_timestamp() - interval '1 days' + interval '1 minutes')
);
select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000003',
  'payment-c', 'subscription-3', 'approved', 1499, 'BRL',
  (transaction_timestamp() - interval '2 days' + interval '0 minutes'), (transaction_timestamp() - interval '0 days' + interval '1 minutes')
);
select is(
  (select terminal_status from public.payment_transactions where provider_payment_id = 'payment-c'),
  'charged_back',
  'approved to charged back to approved preserves the terminal chargeback'
);
select is(
  (select status from public.subscriptions where user_id = '10000000-0000-4000-8000-000000000003'),
  'expired',
  'chargeback expires the subscription'
);

select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000004',
  'payment-d', 'subscription-4', 'rejected', 1499, 'BRL',
  null, (transaction_timestamp() - interval '2 days' + interval '1 minutes')
);
select is(
  (select status_reason from public.payment_checkout_sessions where id = '20000000-0000-4000-8000-000000000004'),
  'payment_rejected', 'rejection reason is written atomically with payment status'
);
select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000004',
  'payment-d', 'subscription-4', 'approved', 1499, 'BRL',
  (transaction_timestamp() - interval '1 days' + interval '0 minutes'), (transaction_timestamp() - interval '1 days' + interval '1 minutes')
);
select is(
  (select status from public.subscriptions where user_id = '10000000-0000-4000-8000-000000000004'),
  'active',
  'a rejected payment can later be approved for the first time'
);
select ok(
  (select credit_applied_at is not null from public.payment_transactions where provider_payment_id = 'payment-d'),
  'first real approval after rejection grants exactly one credit'
);

select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000005',
  'payment-e', 'subscription-5', 'approved', 1499, 'BRL',
  (transaction_timestamp() - interval '1 days' + interval '0 minutes'), (transaction_timestamp() - interval '1 days' + interval '1 minutes')
);
select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000005',
  'payment-e', 'subscription-5', 'rejected', 1499, 'BRL',
  null, (transaction_timestamp() - interval '2 days' + interval '1 minutes')
);
select is(
  (select provider_status from public.payment_transactions where provider_payment_id = 'payment-e'),
  'approved',
  'older provider observation cannot regress the payment status'
);
select is(
  (select status from public.subscriptions where user_id = '10000000-0000-4000-8000-000000000005'),
  'active',
  'older provider observation cannot revoke valid access'
);

select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000008',
  'payment-old-refund', 'subscription-8', 'approved', 1499, 'BRL',
  (transaction_timestamp() - interval '1 days' + interval '0 minutes'), (transaction_timestamp() - interval '1 days' + interval '1 minutes')
);
select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000008',
  'payment-old-refund', 'subscription-8', 'refunded', 1499, 'BRL',
  (transaction_timestamp() - interval '1 days' + interval '0 minutes'), (transaction_timestamp() - interval '2 days' + interval '1 minutes')
);
select is(
  (
    select terminal_status
    from public.payment_transactions
    where provider_payment_id = 'payment-old-refund'
  ),
  'refunded',
  'an older terminal refund observation is still absorbing'
);
select is(
  (
    select status
    from public.subscriptions
    where user_id = '10000000-0000-4000-8000-000000000008'
  ),
  'expired',
  'an older terminal refund observation expires access'
);

select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000009',
  'payment-old-chargeback', 'subscription-9', 'approved', 1499, 'BRL',
  (transaction_timestamp() - interval '1 days' + interval '0 minutes'), (transaction_timestamp() - interval '1 days' + interval '1 minutes')
);
select public.apply_mercado_pago_payment(
  '20000000-0000-4000-8000-000000000009',
  'payment-old-chargeback', 'subscription-9', 'charged_back', 1499, 'BRL',
  (transaction_timestamp() - interval '1 days' + interval '0 minutes'), (transaction_timestamp() - interval '2 days' + interval '1 minutes')
);
select is(
  (
    select terminal_status
    from public.payment_transactions
    where provider_payment_id = 'payment-old-chargeback'
  ),
  'charged_back',
  'an older terminal chargeback observation is still absorbing'
);
select is(
  (
    select status
    from public.subscriptions
    where user_id = '10000000-0000-4000-8000-000000000009'
  ),
  'expired',
  'an older terminal chargeback observation expires access'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'private.payment_checkout_rate_limits'::regclass
  ),
  'rate limit state has RLS enabled as defense in depth'
);
select throws_ok(
  $$
    update public.payment_transactions
    set credit_applied_at = null
    where provider_payment_id = 'payment-a'
  $$,
  'P0001',
  'Payment credit marker is immutable',
  'credited payments cannot have their marker cleared'
);
select throws_ok(
  $$
    update public.payment_transactions
    set terminal_status = null
    where provider_payment_id = 'payment-b'
  $$,
  'P0001',
  'Payment terminal marker is immutable',
  'terminal payment state cannot be cleared'
);

select ok(
  (select not claimed from public.claim_payment_checkout_reconciliation(
    '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'
  )),
  'reconciliation cannot claim another user checkout'
);
select ok(
  (select not claimed from public.claim_payment_checkout_reconciliation(
    '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'
  )),
  'terminal checkout is not queried again at the provider'
);
select throws_ok(
  $$select public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001',
    'wrong-amount', 'subscription-1', 'approved', 1, 'BRL', now(), now())$$,
  'P0001', 'Payment amount does not match checkout', 'divergent amount is rejected'
);
select throws_ok(
  $$select public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001',
    'wrong-currency', 'subscription-1', 'approved', 1499, 'USD', now(), now())$$,
  'P0001', 'Payment amount does not match checkout', 'divergent currency is rejected'
);
select throws_ok(
  $$select public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001',
    'wrong-subscription', 'subscription-2', 'approved', 1499, 'BRL', now(), now())$$,
  'P0001', 'Subscription correlation failed', 'divergent subscription is rejected'
);
select throws_ok(
  $$select public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000002',
    'payment-a', 'subscription-2', 'approved', 1499, 'BRL', now(), now())$$,
  'P0001', 'Payment correlation failed', 'payment cannot be credited to a second checkout'
);

select is(
  (select status_reason from public.payment_checkout_sessions where id = '20000000-0000-4000-8000-000000000002'),
  'payment_refunded', 'late approval cannot erase a refund reason'
);
select is(
  (select status_reason from public.payment_checkout_sessions where id = '20000000-0000-4000-8000-000000000003'),
  'payment_chargeback', 'late approval cannot erase a chargeback reason'
);
select ok(
  (select status_reason is null from public.payment_checkout_sessions where id = '20000000-0000-4000-8000-000000000005'),
  'old rejected observation cannot change an approved checkout reason'
);
select public.sync_mercado_pago_subscription('subscription-2', 'pending');
select is(
  (select status from public.payment_checkout_sessions where id = '20000000-0000-4000-8000-000000000002'),
  'canceled', 'preapproval cannot reopen a refunded checkout'
);
select is(
  (select status_reason from public.payment_checkout_sessions where id = '20000000-0000-4000-8000-000000000002'),
  'payment_refunded', 'preapproval cannot replace a refund reason'
);
select public.sync_mercado_pago_subscription('subscription-3', 'canceled');
select is(
  (select status_reason from public.payment_checkout_sessions where id = '20000000-0000-4000-8000-000000000003'),
  'payment_chargeback', 'renewal cancellation cannot replace a chargeback reason'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.get_payment_checkout_status('20000000-0000-4000-8000-000000000001')),
  1, 'authenticated user can read their checkout via the scoped RPC'
);
select is(
  (select count(*)::integer from public.get_payment_checkout_status('20000000-0000-4000-8000-000000000002')),
  0, 'authenticated user cannot read another user checkout via the RPC'
);
select is(
  (select count(user_id)::integer from public.subscriptions where user_id = '10000000-0000-4000-8000-000000000001'),
  1, 'RLS exposes the owner subscription'
);
select is(
  (select count(user_id)::integer from public.subscriptions where user_id = '10000000-0000-4000-8000-000000000002'),
  0, 'RLS hides other user subscriptions'
);
select throws_ok(
  $$update public.subscriptions set status = 'active'$$,
  '42501', 'permission denied for table subscriptions', 'client cannot grant subscription access'
);
select throws_ok(
  $$select * from public.payment_checkout_sessions$$,
  '42501', 'permission denied for table payment_checkout_sessions', 'client cannot bypass checkout RPC'
);
select throws_ok(
  $$select public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001',
    'client-forged', 'subscription-1', 'approved', 1499, 'BRL', now(), now())$$,
  '42501', 'permission denied for function apply_mercado_pago_payment', 'client cannot forge payment approval'
);
set local request.jwt.claim.sub = '';
select is(
  (select count(*)::integer from public.get_payment_checkout_status('20000000-0000-4000-8000-000000000001')),
  0, 'empty authenticated identity cannot see a checkout'
);
set local role anon;
select throws_ok(
  $$select * from public.get_payment_checkout_status('20000000-0000-4000-8000-000000000001')$$,
  '42501', 'permission denied for function get_payment_checkout_status', 'anon cannot query checkout status'
);
reset role;

select * from finish();
rollback;
