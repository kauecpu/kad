begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(15);

insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','lifecycle-a@test.invalid','{"username":"lifecycle_a"}'),
 ('10000000-0000-4000-8000-000000000002','lifecycle-b@test.invalid','{"username":"lifecycle_b"}');
insert into public.payment_checkout_sessions
 (id,user_id,plan,billing_cycle,provider,provider_subscription_id,amount_cents,status)
values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','diamond','monthly','mercado_pago','lifecycle-1',1499,'pending'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','diamond','monthly','mercado_pago','lifecycle-2',1499,'pending');
create temp table lifecycle_claim as select * from public.claim_payment_webhook('lifecycle-event','payment',null,'lifecycle-payment',true);
select is((select outcome from lifecycle_claim),'claimed','first attempt owns event');
select is((select outcome from public.claim_payment_webhook('lifecycle-event','payment',null,'lifecycle-payment',true)),'busy','simultaneous attempt must retry');
select ok(public.finish_payment_webhook('lifecycle-event',(select token from lifecycle_claim),false,'processing_failed'),'failure releases claim');
create temp table lifecycle_retry as select * from public.claim_payment_webhook('lifecycle-event','payment',null,'lifecycle-payment',true);
select is((select outcome from lifecycle_retry),'claimed','retry owns incomplete event');
select ok(not public.finish_payment_webhook('lifecycle-event',(select token from lifecycle_claim),true,null),'old token cannot finish new attempt');
select ok(public.finish_payment_webhook('lifecycle-event',(select token from lifecycle_retry),true,null),'owner finishes event');
select is((select outcome from public.claim_payment_webhook('lifecycle-event','payment',null,'lifecycle-payment',true)),'duplicate','completed event stays completed');

select public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001','lifecycle-payment','lifecycle-1','approved',1499,'BRL','2030-01-01T00:00:00Z','2030-01-01T00:00:00Z');
create temp table lifecycle_period as select current_period_end from public.subscriptions where provider_subscription_id='lifecycle-1';
select public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001','lifecycle-payment','lifecycle-1','approved',1499,'BRL','2030-01-01T00:00:00Z','2030-01-01T00:00:00Z');
select is((select count(*)::integer from public.payment_transactions where provider_payment_id='lifecycle-payment'),1,'one payment row across reconciliation and webhook');
select is((select current_period_end from public.subscriptions where provider_subscription_id='lifecycle-1'),(select current_period_end from lifecycle_period),'duplicate does not extend period');
select public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001','lifecycle-rejected','lifecycle-1','rejected',1499,'BRL','2030-01-02T00:00:00Z','2030-01-02T00:00:00Z');
select is((select current_period_end from public.subscriptions where provider_subscription_id='lifecycle-1'),(select current_period_end from lifecycle_period),'rejection preserves paid period');
select public.sync_mercado_pago_subscription('lifecycle-1','canceled','2030-01-03T00:00:00Z');
select is((select current_period_end from public.subscriptions where provider_subscription_id='lifecycle-1'),(select current_period_end from lifecycle_period),'cancellation preserves paid period');
select public.sync_mercado_pago_subscription('lifecycle-1','authorized','2030-01-01T00:00:00Z');
select is((select status from public.subscriptions where provider_subscription_id='lifecycle-1'),'canceled','old authorization cannot override cancellation');

select public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000002','lifecycle-expired','lifecycle-2','approved',1499,'BRL','2000-01-01T00:00:00Z','2000-01-01T00:00:00Z');
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select is((select status from public.get_current_subscription()),'expired','server clock rejects expired benefits');
select is((select count(*)::integer from public.get_current_subscription()),1,'RPC exposes only own subscription');
select throws_ok($$select * from public.claim_payment_webhook('forged','payment',null,'forged',true)$$,'42501','permission denied for function claim_payment_webhook','user cannot claim notifications');
reset role;
select * from finish();
rollback;
