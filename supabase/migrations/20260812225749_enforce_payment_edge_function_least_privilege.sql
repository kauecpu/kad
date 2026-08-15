revoke all privileges
on table public.payment_checkout_sessions
from service_role;

revoke all privileges
on table public.subscriptions
from service_role;

revoke all privileges
on table public.payment_transactions
from service_role;

revoke all privileges
on table public.payment_webhook_events
from service_role;

grant select, insert, update
on table public.payment_checkout_sessions
to service_role;

grant select
on table public.subscriptions
to service_role;

grant select, insert, update
on table public.payment_webhook_events
to service_role;

