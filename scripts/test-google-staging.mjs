// Explicitly authorized staging only. Provider outcomes are fixtures, never real purchases.
// Administrative credentials are used for fixture setup/internal RPC only, not user requests.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

const project = 'npaoyezfwmgauirrlyog';
const base = `https://${project}.supabase.co`;
if (process.argv[2] !== '--confirm-staging') throw new Error('Explicit staging authorization required');
const keys = JSON.parse(process.env.KAD_TEST_STAGE_KEYS ?? '[]');
delete process.env.KAD_TEST_STAGE_KEYS;
const serviceKey = keys.find(key => key.name === 'service_role')?.api_key;
const publicKey = keys.find(key => key.type === 'publishable')?.api_key;
if (!serviceKey || !publicKey?.startsWith('sb_publishable_')) throw new Error('Staging keys unavailable');
const claims = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url'));
assert.equal(claims.ref, project); assert.equal(claims.role, 'service_role');
const admin = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const run = randomUUID(); const fixtures = [];
let requests = 0;
async function http(path, headers, method = 'POST', body) {
  const url = new URL(path, base);
  assert.equal(url.origin, base);
  assert.ok(++requests <= 60, 'Bounded request budget');
  const response = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
    redirect: 'error', signal: AbortSignal.timeout(20000) });
  return { status: response.status, data: await response.json().catch(() => null) };
}
async function fixture(label) {
  const email = `kad-google-${run}-${label}@example.invalid`;
  const password = `Aa1!${randomBytes(30).toString('base64url')}`;
  const created = await http('/auth/v1/admin/users', admin, 'POST', {
    email, password, email_confirm: true, user_metadata: { validation_fixture: run },
  });
  assert.equal(created.status, 200); assert.ok(created.data?.id);
  const user = { id: created.data.id, email }; fixtures.push(user);
  const login = await http('/auth/v1/token?grant_type=password', { apikey: publicKey }, 'POST', { email, password });
  assert.equal(login.status, 200); assert.equal(login.data.user.id, user.id);
  user.headers = { apikey: publicKey, Authorization: `Bearer ${login.data.access_token}` };
  return user;
}
const rpc = (headers, user, token, status = 'active', entitled = true, product = 'kad_diamond_monthly') =>
  http('/rest/v1/rpc/apply_google_play_purchase', headers, 'POST', {
    p_user_id: user.id, p_purchase_token: `fixture-${run}-${token}`, p_product_id: product,
    p_order_id: 'fixture-order', p_provider_status: status, p_expires_at: '2099-01-01T00:00:00Z',
    p_auto_renew: true, p_entitled: entitled,
  });
async function state(user) {
  const response = await http('/rest/v1/subscriptions?select=status,provider,plan', user.headers, 'GET');
  assert.equal(response.status, 200); return response.data;
}
try {
  const a = await fixture('a'); const b = await fixture('b');
  assert.equal((await state(a)).length, 0); assert.equal((await state(b)).length, 0);
  for (const headers of [{ apikey: publicKey }, a.headers, b.headers]) {
    assert.ok([401, 403].includes((await rpc(headers, a, 'denied')).status));
  }
  assert.equal((await rpc(admin, a, 'old')).status, 200);
  assert.equal((await state(a))[0].status, 'active');
  assert.equal((await state(b)).length, 0, 'B cannot read A subscription');
  assert.equal((await rpc(admin, a, 'old', 'past_due', true)).data[0].entitled, false);
  assert.equal((await state(a))[0].status, 'expired', 'legacy true flag cannot grant suspended access');
  await rpc(admin, a, 'old'); await rpc(admin, a, 'new');
  await rpc(admin, a, 'old', 'past_due', false);
  assert.equal((await state(a))[0].status, 'active', 'other valid purchase survives');
  const deniedOwner = await rpc(admin, b, 'new');
  assert.equal(deniedOwner.status, 400); assert.equal(deniedOwner.data.code, 'P0001');
  assert.equal((await rpc(admin, a, 'new', 'active', true, 'kad_platinum_monthly')).status, 400);
  await rpc(admin, a, 'new', 'expired', false); await rpc(admin, a, 'new', 'expired', false);
  assert.equal((await state(a)).length, 1); assert.equal((await state(a))[0].status, 'expired');
  assert.equal((await state(b)).length, 0);
  console.log(JSON.stringify({ result: 'PASS', project, run, scenarios: [
    'real Auth A/B', 'anonymous/client RPC denied', 'fixture active -> revoked in database',
    'other valid purchase preserved', 'token owner/product mismatch denied', 'repeat without duplicate subscription', 'RLS A/B',
  ], limitation: 'Administrative RPC uses provider fixtures; does not prove Google verification.' }));
} catch {
  console.error('FAIL staging Google fixture validation. No credential-bearing response printed.');
  process.exitCode = 1;
} finally {
  for (const user of fixtures) {
    try {
      const before = await http(`/auth/v1/admin/users/${user.id}`, admin, 'GET');
      assert.equal(before.data?.email, user.email); assert.equal(before.data?.user_metadata?.validation_fixture, run);
      assert.equal((await http(`/auth/v1/admin/users/${user.id}`, admin, 'DELETE')).status, 200);
      assert.equal((await http(`/auth/v1/admin/users/${user.id}`, admin, 'GET')).status, 404);
    } catch { console.error(`Fixture cleanup requires attention for run ${run}`); process.exitCode = 1; }
  }
  console.log(JSON.stringify({ run, requests, cleanup: process.exitCode ? 'check results' : 'PASS' }));
}
