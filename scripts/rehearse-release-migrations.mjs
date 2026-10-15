// Offline rehearsal only. No connection string, credentials or remote database.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const directory = new URL('../supabase/migrations/', import.meta.url);
const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
const alreadyAppliedLater = new Set([
  '20261008003639_enforce_simulation_entitlements.sql',
  '20261008215543_abuse_protection.sql',
  '20261009231430_preserve_simulation_sync_version.sql',
]);
const baseline = files.filter((name) => name <= '20260828220803_controlled_question_publication.sql'
  || alreadyAppliedLater.has(name));
const pending = files.filter((name) => !baseline.includes(name)
  && name <= '20261009231430_preserve_simulation_sync_version.sql');
assert.equal(baseline.length, 23);
assert.equal(pending.length, 16);

// Minimal Supabase-managed objects; application SQL is executed unchanged.
// This fixture does not emulate GoTrue, Storage API, PostgREST or concurrent sessions.
const bootstrap = `
  set timezone = 'UTC';
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql as
    $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
  create table storage.buckets(id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key, bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(text) returns text[] language sql immutable as
    $$select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1)-1]$$;
  grant usage on schema public, auth to anon, authenticated, service_role;
`;
const fingerprintSql = `
  select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args,
    md5(pg_get_functiondef(p.oid)) as definition,
    has_function_privilege('anon', p.oid, 'execute') as anon,
    has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
    has_function_privilege('service_role', p.oid, 'execute') as service
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private') order by 1,2,3;
`;
async function apply(db, names) {
  for (const name of names) {
    try { await db.exec(await readFile(new URL(name, directory), 'utf8')); }
    catch (error) { throw new Error(`Migration failed: ${name}`, { cause: error }); }
  }
}
async function snapshot(db) { return (await db.query(fingerprintSql)).rows; }

let db = new PGlite();
let expected;
try {
  await db.exec(bootstrap);
  await apply(db, files);
  expected = await snapshot(db);
} finally { await db.close(); }

db = new PGlite();
try {
  await db.exec(bootstrap);
  await apply(db, baseline);
  const before = await snapshot(db);
  assert.equal(before.find((row) => row.proname === 'consume_abuse_limit').service, true);
  await apply(db, pending);
  const after = await snapshot(db);
  assert.equal(after.find((row) => row.proname === 'consume_abuse_limit').service, false,
    'Reproduce historical baseline revoking the already deployed abuse limiter');
  const drift = after.filter((row, i) => JSON.stringify(row) !== JSON.stringify(expected[i]));
  console.log('Drift after the 16 missing migrations:', JSON.stringify(drift, null, 2));
  await apply(db, files.filter((name) => name > '20261009231430_preserve_simulation_sync_version.sql'));
  assert.deepEqual(await snapshot(db), expected,
    'Out-of-order upgrade must preserve all function definitions and API grants');
  await db.exec(`insert into auth.users values
    ('10000000-0000-4000-8000-000000000001', 'release-fixture@example.invalid', '{}');
    set role service_role;`);
  for (let attempt = 1; attempt <= 6; attempt++) {
    const { rows } = await db.query(`select * from public.consume_abuse_limit(
      '10000000-0000-4000-8000-000000000001', 'account_delete')`);
    assert.equal(rows[0].allowed, attempt <= 5);
    if (attempt === 6) assert.ok(rows[0].retry_after_seconds > 0);
  }
  await db.exec('reset role');
  const { rows } = await db.query(`select has_table_privilege(
    'service_role', 'private.abuse_limit_counters', 'select') as direct_access`);
  assert.equal(rows[0].direct_access, false);
  console.log(`PASS: ${baseline.length} recorded + ${pending.length} missing migrations; final functions/grants match a fresh database.`);
  console.log('PASS: service_role RPC allows five attempts, blocks the sixth; counters stay private.');
} finally { await db.close(); }
