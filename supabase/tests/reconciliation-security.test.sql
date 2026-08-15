begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(29);

select has_table('public', 'questions', 'questions table exists');
select has_table('private', 'editorial_import_batches', 'private import batches table exists');
select has_table('private', 'editorial_import_items', 'private import items table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.questions'::regclass),
  'questions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.editorial_import_batches'::regclass),
  'private import batches have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.editorial_import_items'::regclass),
  'private import items have RLS enabled'
);

select ok(
  has_table_privilege('anon', 'public.questions', 'SELECT'),
  'anon may select questions subject to RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.questions', 'SELECT'),
  'authenticated may select questions subject to RLS'
);

select ok(
  not has_table_privilege('anon', 'public.questions', 'TRUNCATE'),
  'anon cannot truncate questions'
);
select ok(
  not has_table_privilege('authenticated', 'public.questions', 'TRUNCATE'),
  'authenticated cannot truncate questions'
);
select ok(
  not has_table_privilege('anon', 'public.questions', 'REFERENCES'),
  'anon cannot create references to questions'
);
select ok(
  not has_table_privilege('authenticated', 'public.questions', 'TRIGGER'),
  'authenticated cannot create triggers on questions'
);

select ok(
  not has_table_privilege('authenticated', 'private.editorial_import_batches', 'SELECT'),
  'authenticated cannot read private import batches directly'
);
select ok(
  not has_table_privilege('authenticated', 'private.editorial_import_items', 'SELECT'),
  'authenticated cannot read private import items directly'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_create_import_batch(text,jsonb)',
    'EXECUTE'
  ),
  'authenticated may call the permission-checking import RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_create_import_batch(text,jsonb)',
    'EXECUTE'
  ),
  'anon cannot call the import RPC'
);

select ok(
  not has_table_privilege('anon', 'public.payment_transactions', 'SELECT'),
  'anon cannot read payment transactions'
);
select ok(
  not has_table_privilege('authenticated', 'public.payment_transactions', 'SELECT'),
  'authenticated cannot read payment transactions directly'
);
select ok(
  not has_table_privilege('anon', 'public.payment_webhook_events', 'SELECT'),
  'anon cannot read payment webhook events'
);
select ok(
  not has_table_privilege('authenticated', 'public.payment_webhook_events', 'SELECT'),
  'authenticated cannot read payment webhook events'
);

select has_index(
  'private',
  'admin_audit_logs',
  'admin_audit_logs_actor_id_idx',
  'admin audit actor FK is indexed'
);
select has_index(
  'private',
  'admin_users',
  'admin_users_created_by_idx',
  'admin creator FK is indexed'
);
select has_index(
  'public',
  'concursos',
  'concursos_created_by_idx',
  'concurso creator FK is indexed'
);
select has_index(
  'public',
  'concursos',
  'concursos_updated_by_idx',
  'concurso updater FK is indexed'
);
select has_index(
  'public',
  'payment_transactions',
  'payment_transactions_checkout_session_id_idx',
  'payment transaction checkout FK is indexed'
);
select has_index(
  'private',
  'editorial_import_batches',
  'editorial_import_batches_created_by_idx',
  'import batch creator FK is indexed'
);
select has_index(
  'public',
  'questions',
  'questions_created_by_idx',
  'question creator FK is indexed'
);
select has_index(
  'public',
  'questions',
  'questions_updated_by_idx',
  'question updater FK is indexed'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
  ),
  'client roles have no destructive or DDL privileges on public tables'
);

select * from finish();
rollback;
