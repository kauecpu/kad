grant select, insert, update
on table public.payment_checkout_sessions
to service_role;

grant select
on table public.subscriptions
to service_role;

grant select, insert, update
on table public.payment_webhook_events
to service_role;

