-- Read-only. Choose the project ref explicitly in the caller.
-- Production: tknxtwwwoqwbzddplzzg. Staging: npaoyezfwmgauirrlyog.
begin read only;

select version, name from supabase_migrations.schema_migrations order by version;

select n.nspname as schema, p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  md5(pg_get_functiondef(p.oid)) as definition_hash,
  has_function_privilege('anon', p.oid, 'execute') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by 1, 2, 3;

select n.nspname as schema, c.relname, c.relrowsecurity as rls,
  has_table_privilege('anon', c.oid, 'select') as anon_select,
  has_table_privilege('authenticated', c.oid, 'select') as authenticated_select,
  has_table_privilege('service_role', c.oid, 'select') as service_select
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private') and c.relkind = 'r'
order by 1, 2;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public', 'private') order by 1, 2, 3;

select count(*) as checkouts from public.payment_checkout_sessions;
select count(*) as subscriptions from public.subscriptions;
select count(*) as transactions from public.payment_transactions;
select count(*) as simulation_sessions from public.simulation_sessions;
select count(*) as questions from public.questions;

select t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t where t.tgrelid = 'public.simulation_sessions'::regclass
  and not t.tgisinternal order by 1;

select n.nspname as schema, c.relname as index_name, i.indisvalid
from pg_index i join pg_class c on c.oid = i.indexrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private') and not i.indisvalid order by 1, 2;

commit;
