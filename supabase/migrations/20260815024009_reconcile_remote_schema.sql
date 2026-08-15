revoke truncate, references, trigger
on all tables in schema public
from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
revoke truncate, references, trigger on tables
from anon, authenticated, service_role;

create index if not exists admin_audit_logs_actor_id_idx
  on private.admin_audit_logs (actor_id);

create index if not exists admin_users_created_by_idx
  on private.admin_users (created_by);

create index if not exists concursos_created_by_idx
  on public.concursos (created_by);

create index if not exists concursos_updated_by_idx
  on public.concursos (updated_by);

create index if not exists payment_transactions_checkout_session_id_idx
  on public.payment_transactions (checkout_session_id);
