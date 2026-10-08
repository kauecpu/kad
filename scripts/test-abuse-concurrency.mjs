// Disposable native PostgreSQL only. Refuses remote targets and populated schemas.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { paymentBootstrap } from '../tests/helpers/payment-database.ts';

if (!['localhost','127.0.0.1'].includes(process.env.PGHOST)
  || (process.env.PGHOSTADDR && process.env.PGHOSTADDR !== '127.0.0.1')
  || process.env.PGSERVICE || process.env.PGDATABASE !== 'kad_abuse_test') {
  throw new Error('Requires disposable localhost kad_abuse_test, without PGSERVICE');
}
const env = { ...process.env, PGOPTIONS: '', PGCONNECT_TIMEOUT: '5' };
// Optional externally installed driver for portable PostgreSQL distributions
// without psql. CI uses its standard psql; no runtime app dependency is added.
const Client = process.env.PG_TEST_DRIVER
  ? (await import(pathToFileURL(process.env.PG_TEST_DRIVER).href)).default.Client : null;
function query(sql) {
  if (Client) return (async () => {
    const client = new Client({ host: '127.0.0.1', port: Number(env.PGPORT), database: env.PGDATABASE,
      user: env.PGUSER, password: env.PGPASSWORD, options: '', connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      const results = await client.query(sql);
      return (Array.isArray(results) ? results : [results]).flatMap(result => result.rows)
        .map(row => Object.values(row).map(value => typeof value === 'boolean' ? (value ? 't' : 'f') : String(value)).join('|')).join('\n');
    } finally { await client.end(); }
  })();
  return new Promise((resolve,reject) => {
    const child = spawn(process.env.PSQL_PATH || 'psql',['-X','-qAt','-v','ON_ERROR_STOP=1'], { env, windowsHide:true, stdio:['pipe','pipe','pipe'] });
    let output = ''; let error = '';
    child.stdout.on('data', value => output += value);
    child.stderr.on('data', value => error += value);
    child.on('error',reject);
    child.on('close',code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
    child.stdin.end(sql);
  });
}
let expectedAddress = '127.0.0.1';
if (process.env.KAD_TEST_CONTAINER_ID) {
  // Docker NAT changes inet_server_addr(). Prove the exact CI-owned container
  // and its loopback port binding, never accept an arbitrary expected IP.
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.match(process.env.KAD_TEST_CONTAINER_ID, /^[a-f0-9]{64}$/);
  const { stdout } = await promisify(execFile)('docker', ['inspect', process.env.KAD_TEST_CONTAINER_ID]);
  const [container] = JSON.parse(stdout);
  assert.equal(container.State.Running, true);
  assert.equal(container.Config.Image, 'postgres:17');
  const bindings = container.NetworkSettings.Ports['5432/tcp'];
  assert.ok(bindings.some(binding => binding.HostIp === '127.0.0.1' && binding.HostPort === env.PGPORT));
  const addresses = Object.values(container.NetworkSettings.Networks).map(network => network.IPAddress);
  assert.equal(addresses.length, 1);
  expectedAddress = addresses[0];
  assert.ok(expectedAddress);
}
assert.equal(await query("select host(inet_server_addr()) || ':' || current_database()"), `${expectedAddress}:kad_abuse_test`);
assert.equal(await query("select count(*) from information_schema.tables where table_schema in ('public','private','auth')"), '0', 'Requires an empty disposable database');
console.log('Verified loopback target (native or exact CI container) and empty kad_abuse_test; synthetic fixtures only.');
const bootstrap = paymentBootstrap.replace('create role anon; create role authenticated; create role service_role;', () => `
  do $$begin
    if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
    if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if;
  end$$;`);
const migration = await readFile(new URL('../supabase/migrations/20261008215543_abuse_protection.sql', import.meta.url),'utf8');
await query(bootstrap + migration);
const a='10000000-0000-4000-8000-000000000001', b='10000000-0000-4000-8000-000000000002';
await query(`insert into auth.users values ('${a}'),('${b}');`);
const consume = user => `set role service_role; select allowed from public.consume_abuse_limit('${user}','account_delete');`;
const outcomes = await Promise.all(Array.from({length:24},() => query(consume(a))));
assert.equal(outcomes.filter(value => value === 't').length,5);
assert.equal(outcomes.filter(value => value === 'f').length,19);
assert.equal(await query(`select attempts from private.abuse_limit_counters where user_id='${a}'`),'5');
assert.equal(await query(consume(b)),'t');
await query(migration);
assert.equal(await query(consume(a)),'f', 'replay must not reset quota');
for (const role of ['anon','authenticated']) {
  await assert.rejects(() => query(`set role ${role}; select * from public.consume_abuse_limit('${b}','account_delete');`), /permission denied/);
  await assert.rejects(() => query(`set role ${role}; delete from private.abuse_limit_counters;`), /permission denied/);
  await assert.rejects(() => query(`set role ${role}; update private.abuse_limit_policies set max_attempts=999;`), /permission denied/);
}
await query(`update private.abuse_limit_counters set window_started_at=clock_timestamp()-interval '901 seconds' where user_id='${a}';`);
assert.equal(await query(consume(a)),'t');
console.log('PASS: 24 concurrent connections = 5 allowed + 19 denied; independent users; replay; expiry; direct RPC/table denials.');

// Force cleanup batches to overlap: the first request prunes the second user's
// expired row, while the next cleanup would prune the first user's row. Only
// a disposable fixture trigger delays cleanup; no sleeps in production SQL.
await query(`
  insert into auth.users select ('20000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid from generate_series(1,64) i;
  insert into private.abuse_limit_counters
    select id, 'account_delete', clock_timestamp()-interval '2 days', 1,
      clock_timestamp()-interval '1 day' + row_number() over(order by id)*interval '1 second'
    from auth.users where id::text like '20000000-%';
  create function private.fixture_cleanup_pause() returns trigger language plpgsql as $$
    begin perform pg_sleep(2); return null; end$$;
  create trigger fixture_cleanup_pause after delete on private.abuse_limit_counters
    for each statement execute function private.fixture_cleanup_pause();
`);
const consumeResult = (sql) => query(sql).then(value => ({value}), error => ({error: error.message}));
const firstCleanup = consumeResult(`set application_name='kad-abuse-cleanup-first';
  ${consume('20000000-0000-4000-8000-000000000064')}`);
try {
  let reachedCleanup = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await query("select count(*) from pg_stat_activity where application_name='kad-abuse-cleanup-first' and wait_event='PgSleep'") === '1') {
      reachedCleanup = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.ok(reachedCleanup, 'first request reached cleanup fixture barrier');
  const outcomes = await Promise.all([firstCleanup, consumeResult(consume('20000000-0000-4000-8000-000000000001'))]);
  assert.deepEqual(outcomes, [{value:'t'}, {value:'t'}], 'cleanup must not deadlock concurrent consumers');
  assert.equal(await query("select count(*) from private.abuse_limit_counters where user_id::text like '20000000-%' and attempts=1 and expires_at>clock_timestamp()"),'2');
  console.log('PASS: overlapping expired-counter cleanup does not deadlock or erase newly confirmed attempts.');
} finally {
  await firstCleanup;
  await query('drop trigger fixture_cleanup_pause on private.abuse_limit_counters; drop function private.fixture_cleanup_pause();');
}
console.log('This tests native Postgres, not the Supabase Auth/gateway/HTTP stack.');
