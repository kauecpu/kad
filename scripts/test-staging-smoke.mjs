// Real Auth/PostgREST/Edge requests against the hard-coded staging project only.
// Input on stdin: { run, users: [{ id, label, email, password }] }.
// Provision isolated, confirmed fixtures beforehand; remove them afterwards.
// Never persist this input or use a real customer's account.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const project = 'npaoyezfwmgauirrlyog';
const base = `https://${project}.supabase.co`;
if (process.argv[2] !== '--confirm-staging') throw new Error('Explicit staging flag required');
const phase = process.argv[3] ?? 'study';
assert.ok(['study', 'paid', 'edge'].includes(phase));
const fixtures = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
assert.match(fixtures.run, /^[a-f0-9-]{36}$/);
assert.equal(fixtures.users.length, 3);
assert.equal(new Set(fixtures.users.map(user => user.label)).size, 3);
assert.equal(new Set(fixtures.users.map(user => user.id)).size, 3);
for (const user of fixtures.users) {
  assert.match(user.id, /^[a-f0-9-]{36}$/);
  assert.ok(['a', 'b', 'c'].includes(user.label));
  assert.equal(user.email, `kad-stage-${fixtures.run}-${user.label}@example.invalid`);
  assert.ok(user.password.length >= 30);
}
const env = Object.fromEntries(readFileSync(new URL('../.env.staging.local', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(line => line.includes('=')).map(line => {
    const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim()];
  }));
for (const [name, value] of Object.entries(env)) {
  if (name.endsWith('SUPABASE_URL')) assert.equal(value.replace(/\/$/, ''), base);
}
const publicKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publicKey?.startsWith('sb_publishable_'));
assert.ok(publicKey);
const report = { project, run: fixtures.run, phase, checks: [], requests: 0 };
const users = Object.fromEntries(fixtures.users.map(user => [user.label, user]));
const { a, b, c } = users;
const suffix = fixtures.run;
const expectStatus = (result, expected) => assert.ok([expected].flat().includes(result.status),
  `HTTP ${result.status}; expected ${expected}; code=${result.data?.code ?? result.data?.error_code ?? 'none'}`);
async function http(path, user, method = 'GET', body, extra = {}) {
  const url = new URL(path, base);
  assert.equal(url.origin, base);
  assert.ok(++report.requests <= 180, 'Bounded request budget');
  const response = await fetch(url, {
    method, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { apikey: publicKey, 'Content-Type': 'application/json',
      ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: response.status, data, cors: response.headers.get('access-control-allow-origin'),
    retryAfter: response.headers.get('retry-after') };
}
const rpc = (name, user, body = {}) => http(`/rest/v1/rpc/${name}`, user, 'POST', body);
async function check(name, action) {
  try { await action(); report.checks.push({ name, result: 'PASS' }); }
  catch (error) {
    // Only our bounded assertions are printed; never dump fetch responses/tokens.
    report.checks.push({ name, result: 'FAIL', detail: error.name === 'AssertionError'
      ? error.message.slice(0, 220) : (error.cause?.code ?? error.name) });
  }
}
try {
  await check('real Auth login / profile ownership', async () => {
    for (const user of fixtures.users) {
      const result = await http('/auth/v1/token?grant_type=password', null, 'POST',
        { email: user.email, password: user.password });
      expectStatus(result, 200); assert.equal(result.data.user.id, user.id);
      user.token = result.data.access_token; user.refresh = result.data.refresh_token;
      assert.equal(result.data.user.email, user.email);
      assert.equal(result.data.user.user_metadata.validation_fixture, fixtures.run);
      const profile = await http(`/rest/v1/profiles?id=eq.${user.id}&select=id`, user);
      expectStatus(profile, 200); assert.equal(profile.data[0]?.id, user.id);
      user.validated = true;
    }
  });
  assert.ok(fixtures.users.every(user => user.validated), 'All fixture identities must be verified');
  if (phase === 'study') {
    await check('wrong password rejected; refresh and getUser work', async () => {
      expectStatus(await http('/auth/v1/token?grant_type=password', null, 'POST',
        { email: a.email, password: `${a.password}wrong` }), 400);
      const refresh = await http('/auth/v1/token?grant_type=refresh_token', null, 'POST',
        { refresh_token: a.refresh });
      expectStatus(refresh, 200); a.token = refresh.data.access_token; a.refresh = refresh.data.refresh_token;
      const identity = await http('/auth/v1/user', a); expectStatus(identity, 200);
      assert.equal(identity.data.id, a.id);
    });
    await check('profile update + cross-user read/update denied', async () => {
      expectStatus(await http(`/rest/v1/profiles?id=eq.${a.id}`, a, 'PATCH', { city: 'Staging fixture' }), 204);
      const read = await http(`/rest/v1/profiles?id=eq.${a.id}&select=id,city`, b);
      expectStatus(read, 200); assert.equal(read.data.length, 0);
      const write = await http(`/rest/v1/profiles?id=eq.${a.id}`, b, 'PATCH', { city: 'Blocked' }, { Prefer: 'return=representation' });
      expectStatus(write, 200); assert.equal(write.data.length, 0);
      assert.equal((await http(`/rest/v1/profiles?id=eq.${a.id}&select=city`, a)).data[0].city, 'Staging fixture');
    });
    await check('published questions, server-side answer and favorites', async () => {
      const questions = await http('/rest/v1/questions?publication_status=eq.published&select=id,correct&limit=10', a);
      expectStatus(questions, 200); assert.ok(questions.data.length >= 1);
      const question = questions.data[0]; a.question = question;
      expectStatus(await rpc('record_question_attempt', a, { p_question_id: question.id, p_selected: question.correct }), 204);
      const own = await http(`/rest/v1/question_attempts?question_id=eq.${question.id}&select=is_correct`, a);
      expectStatus(own, 200); assert.equal(own.data[0].is_correct, true);
      assert.equal((await http(`/rest/v1/question_attempts?user_id=eq.${a.id}&select=user_id`, b)).data.length, 0);
      expectStatus(await http('/rest/v1/question_attempts', a, 'POST', {
        user_id: a.id, question_id: question.id, subject: 'forged', selected: 'A', is_correct: true,
      }), 403);
      expectStatus(await http('/rest/v1/question_favorites', a, 'POST', { user_id: a.id, question_id: question.id }), 201);
      assert.equal((await http(`/rest/v1/question_favorites?user_id=eq.${a.id}&select=question_id`, b)).data.length, 0);
    });
    await check('flashcards CRUD/review + owner constraints', async () => {
      const deck = `deck-${suffix}`; const card = `card-${suffix}`;
      expectStatus(await http('/rest/v1/flashcard_decks', a, 'POST', { id: deck, user_id: a.id, name: 'Staging fixture' }), 201);
      expectStatus(await http('/rest/v1/flashcards', a, 'POST', { id: card, deck_id: deck, user_id: a.id, front: 'Fixture question', back: 'Fixture answer' }), 201);
      expectStatus(await http('/rest/v1/flashcards', b, 'POST', { id: `foreign-${suffix}`, deck_id: deck, user_id: b.id, front: 'Blocked', back: 'Blocked' }), 403);
      assert.equal((await http(`/rest/v1/flashcards?id=eq.${card}&select=id`, b)).data.length, 0);
      const now = new Date().toISOString();
      expectStatus(await http('/rest/v1/flashcard_reviews', a, 'POST', {
        id: `review-${suffix}`, user_id: a.id, card_id: card, rating: 'good',
        reviewed_at: now, previous_due_at: now, next_due_at: now,
      }), 201);
      expectStatus(await http(`/rest/v1/flashcards?id=eq.${card}`, a, 'PATCH', { state: 'review', repetitions: 1 }), 204);
      expectStatus(await http(`/rest/v1/flashcard_decks?id=eq.${deck}`, a, 'DELETE'), 204);
      assert.equal((await http(`/rest/v1/flashcards?id=eq.${card}&select=id`, a)).data.length, 0);
    });
    await check('essay sync persists newer document and isolates owners', async () => {
      const args = { p_user_id: a.id, p_topic_id: `essay-${suffix}`, p_content: 'Staging fixture essay',
        p_elapsed_seconds: 30, p_status: 'draft', p_submitted_at: null, p_updated_at: new Date().toISOString() };
      expectStatus(await rpc('sync_essay_document', a, args), 204);
      expectStatus(await rpc('sync_essay_document', a, { ...args, p_content: 'Older snapshot', p_updated_at: '2000-01-01T00:00:00Z' }), 204);
      const own = await http(`/rest/v1/essay_documents?topic_id=eq.essay-${suffix}&select=content`, a);
      assert.equal(own.data[0].content, args.p_content);
      assert.equal((await http(`/rest/v1/essay_documents?user_id=eq.${a.id}&select=topic_id`, b)).data.length, 0);
      const denied = await rpc('sync_essay_document', b, args);
      expectStatus(denied, 400); assert.equal(denied.data.code, 'P0001');
      assert.match(denied.data.message, /Authentication required/);
    });
    await check('gamification is idempotent; ranking starts opt-out', async () => {
      assert.ok(a.question);
      const args = { p_event: { id: `xp-${suffix}`, kind: 'question', itemId: a.question.id, selected: a.question.correct, reviewed: false, xp: 999999 } };
      const first = await rpc('record_level_activity', a, args); expectStatus(first, 200);
      assert.ok(first.data.awardedXp > 0 && first.data.awardedXp < 999999);
      const repeat = await rpc('record_level_activity', a, args); expectStatus(repeat, 200);
      assert.equal(repeat.data.awardedXp, 0); assert.equal(repeat.data.totalXp, first.data.totalXp);
      const profile = await http(`/rest/v1/profiles?id=eq.${a.id}&select=ranking_opt_in`, a);
      assert.equal(profile.data[0].ranking_opt_in, false);
      expectStatus(await rpc('set_ranking_opt_in', a, { p_enabled: true }), 200);
      expectStatus(await rpc('get_ranking', a, { p_period: 'today', p_limit: 10, p_offset: 0 }), 200);
      expectStatus(await rpc('set_ranking_opt_in', a, { p_enabled: false }), 200);
    });
    await check('ordinary user denied admin; support fixture reads dashboard', async () => {
      const ordinary = await rpc('get_my_admin_access', a); expectStatus(ordinary, 200); assert.equal(ordinary.data, null);
      expectStatus(await rpc('admin_dashboard_summary', a), 403);
      const support = await rpc('get_my_admin_access', c); expectStatus(support, 200); assert.equal(support.data.role, 'support');
      expectStatus(await rpc('admin_dashboard_summary', c), 200);
    });
    await check('feedback submission', async () => {
      expectStatus(await rpc('submit_user_feedback', a, { p_category: 'problem', p_message: `Automated staging fixture ${suffix}`,
        p_source_screen: 'staging-validation', p_platform: 'web', p_app_version: 'release-candidate' }), 200);
    });
    await check('free plan cannot create premium simulation or invoke backend limiter', async () => {
      const now = new Date().toISOString(); const id = `free-${suffix}`;
      const result = await rpc('sync_simulation_session', a, { p_user_id: a.id, p_session_id: id, p_status: 'active',
        p_payload: { id, status: 'active', createdAt: now }, p_created_at: now, p_completed_at: null, p_updated_at: now });
      expectStatus(result, 403); assert.match(result.data.message, /subscription_required/);
      expectStatus(await rpc('consume_abuse_limit', a, { p_user_id: a.id, p_operation: 'account_delete' }), 403);
      expectStatus(await rpc('consume_abuse_limit', null, { p_user_id: a.id, p_operation: 'account_delete' }), 401);
    });
  } else if (phase === 'paid') {
    await check('fixture subscription read is isolated', async () => {
      const subscription = await rpc('get_current_subscription', a); expectStatus(subscription, 200);
      assert.equal(subscription.data[0].status, 'active');
      assert.equal((await http(`/rest/v1/subscriptions?user_id=eq.${a.id}&select=status`, b)).data.length, 0);
    });
    await check('premium simulation create/pause/finish + stale snapshot protection', async () => {
      const now = new Date().toISOString(); const id = `paid-${suffix}`;
      const payload = { id, status: 'active', createdAt: now, config: { questionCount: 1 },
        questions: [{ questionId: 'fixture', alternativeOrder: ['A', 'B'] }], answers: {}, remainingSeconds: 300 };
      const args = { p_user_id: a.id, p_session_id: id, p_status: 'active', p_payload: payload,
        p_created_at: now, p_completed_at: null, p_updated_at: now };
      expectStatus(await rpc('sync_simulation_session', a, args), 204);
      expectStatus(await rpc('sync_simulation_session', b, args), 403);
      assert.equal((await http(`/rest/v1/simulation_sessions?user_id=eq.${a.id}&select=session_id`, b)).data.length, 0);
      const later = new Date(Date.now() + 1000).toISOString();
      expectStatus(await rpc('sync_simulation_session', a, { ...args, p_status: 'paused', p_payload: { ...payload, status: 'paused', remainingSeconds: 240 }, p_updated_at: later }), 204);
      expectStatus(await rpc('sync_simulation_session', a, args), 204);
      assert.equal((await http(`/rest/v1/simulation_sessions?session_id=eq.${id}&select=status`, a)).data[0].status, 'paused');
      expectStatus(await rpc('sync_simulation_session', a, { ...args, p_status: 'completed', p_payload: { ...payload, status: 'completed', remainingSeconds: 0 }, p_completed_at: later, p_updated_at: new Date(Date.now() + 2000).toISOString() }), 204);
    });
  } else {
    await check('Edge authentication rejects anonymous requests', async () => {
      for (const name of ['delete-account', 'cancel-subscription', 'create-payment-checkout', 'reconcile-payment-checkout', 'validate-google-purchase']) {
        expectStatus(await http(`/functions/v1/${name}`, null, 'POST', {}), 401);
      }
    });
    await check('cancellation without subscription + actual distributed limit', async () => {
      for (let i = 0; i < 5; i++) {
        const result = await http('/functions/v1/cancel-subscription', b, 'POST', {});
        expectStatus(result, 404); assert.equal(result.data.code, 'subscription_not_found');
      }
      const denied = await http('/functions/v1/cancel-subscription', b, 'POST', {});
      expectStatus(denied, 429); assert.ok(Number(denied.retryAfter) > 0);
    });
    await check('checkout/reconciliation input validation without provider operation', async () => {
      expectStatus(await http('/functions/v1/create-payment-checkout', a, 'POST', { plan: 'invalid', billingCycle: 'invalid' }), 400);
      expectStatus(await http('/functions/v1/reconcile-payment-checkout', a, 'POST', { checkoutId: 'invalid' }), 400);
    });
    await check('Google validation configuration/input gate', async () => {
      const result = await http('/functions/v1/validate-google-purchase', a, 'POST', { productId: 'invalid', purchaseToken: '' });
      expectStatus(result, 400); // A 500 here records missing provider configuration as a release blocker.
    });
    await check('unsigned payment webhook rejected', async () => {
      expectStatus(await http('/functions/v1/mercado-pago-webhook', null, 'POST', { type: 'payment', data: { id: 'fixture' } }), [400, 401]);
    });
    await check('account deletion exact-origin CORS and wrong password', async () => {
      for (const origin of ['https://kadconcursos.com.br', 'https://www.kadconcursos.com.br']) {
        const options = await http('/functions/v1/delete-account', null, 'OPTIONS', undefined, { Origin: origin });
        expectStatus(options, 200); assert.equal(options.cors, origin);
        const wrong = await http('/functions/v1/delete-account', c, 'POST', { currentPassword: `${c.password}wrong` }, { Origin: origin });
        expectStatus(wrong, 403); assert.equal(wrong.cors, origin);
      }
      const evil = await http('/functions/v1/delete-account', c, 'POST', { currentPassword: c.password }, { Origin: 'https://kadconcursos.com.br.evil.invalid' });
      expectStatus(evil, 403); assert.equal(evil.cors, null);
    });
    await check('delete only disposable fixture after password confirmation', async () => {
      const identity = await http('/auth/v1/user', c); expectStatus(identity, 200);
      assert.equal(identity.data.email, c.email); assert.equal(identity.data.user_metadata.validation_fixture, fixtures.run);
      expectStatus(await http('/functions/v1/delete-account', c, 'POST', { currentPassword: c.password }, { Origin: 'https://kadconcursos.com.br' }), 200);
      expectStatus(await http('/auth/v1/user', c), [401, 403]); c.deleted = true;
    });
  }
} catch {
  report.checks.push({ name: 'fixture prerequisites', result: 'FAIL' });
} finally {
  for (const user of fixtures.users.filter(user => user.token && !user.deleted)) {
    await check(`logout ${user.label} invalidates refresh`, async () => {
      expectStatus(await http('/auth/v1/logout?scope=global', user, 'POST'), 204);
      expectStatus(await http('/auth/v1/token?grant_type=refresh_token', null, 'POST', { refresh_token: user.refresh }), 400);
    });
  }
  report.passed = report.checks.filter(check => check.result === 'PASS').length;
  report.failed = report.checks.length - report.passed;
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
}
