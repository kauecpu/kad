begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

select ok(
  not has_schema_privilege('anon', 'public', 'CREATE')
    and not has_schema_privilege('authenticated', 'public', 'CREATE'),
  'client roles cannot create objects in public'
);

select ok(
  not has_schema_privilege('anon', 'private', 'USAGE')
    and not has_schema_privilege('anon', 'private', 'CREATE')
    and not has_schema_privilege('authenticated', 'private', 'CREATE'),
  'client roles cannot create private objects and anon cannot resolve the private schema'
);

select ok(
  not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('public', 'private')
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ),
  'all application tables have RLS enabled'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'private'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  'client roles have no direct privileges on private tables'
);

select ok(
  not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  'anon cannot execute private functions'
);

select ok(
  not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and procedure.oid <> 'private.question_community_accuracy(text[])'::regprocedure
  ),
  'authenticated can execute only the reviewed private helper'
);

select ok(
  not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
      and procedure.oid <> 'public.is_username_available(text)'::regprocedure
  ),
  'anon can execute only the username availability RPC'
);

select ok(
  not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.prosecdef
      and coalesce(array_to_string(procedure.proconfig, ','), '') not like '%search_path=""%'
  ),
  'every SECURITY DEFINER function has an empty search path'
);

select ok(
  not exists (
    select 1
    from pg_default_acl defaults
    cross join lateral aclexplode(defaults.defaclacl) privilege
    left join pg_roles grantee on grantee.oid = privilege.grantee
    where defaults.defaclrole = 'postgres'::regrole
      and defaults.defaclobjtype = 'f'
      and privilege.privilege_type = 'EXECUTE'
      and (privilege.grantee = 0 or grantee.rolname in ('anon', 'authenticated', 'service_role'))
  ),
  'future functions do not receive API execution automatically'
);

select ok(
  not exists (
    select 1
    from pg_default_acl defaults
    cross join lateral aclexplode(defaults.defaclacl) privilege
    join pg_namespace namespace on namespace.oid = defaults.defaclnamespace
    join pg_roles grantee on grantee.oid = privilege.grantee
    where defaults.defaclrole = 'postgres'::regrole
      and namespace.nspname = 'public'
      and defaults.defaclobjtype in ('r', 'S')
      and grantee.rolname in ('anon', 'authenticated')
  ),
  'future public tables and sequences require explicit client grants'
);

select ok(
  has_function_privilege('authenticated', 'public.record_question_attempt(text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.claim_payment_webhook(text,text,text,text,boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.record_question_attempt(text,text)', 'EXECUTE'),
  'reviewed authenticated and service RPCs remain available without anonymous escalation'
);

select * from finish();
rollback;
