// Local browser regressions: synthetic accounts/catalog, all non-local traffic intercepted.
// Start the built site at 127.0.0.1:5193. PLAYWRIGHT_MODULE_PATH supports an external install.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = 'http://127.0.0.1:5193';
const api = 'https://npaoyezfwmgauirrlyog.supabase.co';
const out = await mkdtemp(join(tmpdir(), 'kad-study-regressions-'));
const users = ['a', 'b'].map((label, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  email: `${label}@example.invalid`, aud: 'authenticated', role: 'authenticated', user_metadata: { name: `Fixture ${label}` } }));
const questions = Array.from({ length: 6 }, (_, i) => ({ id: `fixture-q-${i + 1}`, discipline: 'Matemática', subject: 'Aritmética',
  topic: i < 3 ? 'Adição' : 'Subtração', board: i < 3 ? 'Banca fictícia A' : 'Banca fictícia B', year: 2025,
  role: 'Cargo fictício', institution: 'Instituição fictícia', concurso: 'Concurso fictício', level: 'Médio', difficulty: 'Fácil',
  statement: `Questão fictícia ${i + 1}: quanto é ${i + 1} + ${i + 1}?`,
  alternatives: [{ id: 'A', text: String(i + 1) }, { id: 'B', text: String(2 * (i + 1)) }], correct: 'B', explanation: 'Somamos os dois números.' }));
const browser = await chromium.launch({ headless: true });
const results = [];
const stateKey = user => `kad-site/state/v2/${encodeURIComponent(user ? 'user:' + user.id : 'guest')}`;
async function fixture(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block', isMobile: width < 600, hasTouch: width < 600 });
  const f = { context, paid: true, offline: false, attempts: new Map(), sessions: new Map(), essays: new Map(), writes: [], errors: [], blocked: [] };
  await context.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.origin === base) {
      if (url.pathname === '/api/public-config') return json({ environment: 'staging', url: api, publishableKey: 'sb_publishable_isolated_fixture' });
      return route.continue();
    }
    if (url.origin !== api) { f.blocked.push(url.origin + url.pathname); return route.abort(); }
    const user = users.find(u => req.headers().authorization === `Bearer fixture-${u.id}`);
    if (url.pathname === '/auth/v1/token') {
      const login = users.find(u => u.email === req.postDataJSON().email); assert.ok(login);
      return json({ access_token: `fixture-${login.id}`, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user: login });
    }
    if (url.pathname === '/auth/v1/user') return user ? json(user) : json({ message: 'No fixture session' }, 401);
    if (url.pathname === '/auth/v1/logout') return json({});
    if (url.pathname === '/rest/v1/questions') return json(questions);
    if (url.pathname.endsWith('/get_current_subscription')) return json(f.paid ? [{ plan: 'diamond', billing_cycle: 'monthly', provider: 'google',
      status: 'active', current_period_end: '2099-01-01T00:00:00Z', cancel_at_period_end: false }] : []);
    if (url.pathname.endsWith('/record_question_attempt')) {
      if (f.offline) return route.abort();
      assert.ok(user); const p = req.postDataJSON();
      f.attempts.set(user.id + ':' + p.p_question_id, { user_id: user.id, question_id: p.p_question_id, subject: 'Aritmética', selected: p.p_selected,
        is_correct: p.p_selected === 'B', answered_at: new Date().toISOString() });
      f.writes.push({ kind: 'answer', user: user.id, payload: p }); return json({});
    }
    if (url.pathname === '/rest/v1/question_attempts') {
      if (f.offline) return route.abort();
      assert.ok(user); return json([...f.attempts.values()].filter(r => r.user_id === user.id));
    }
    if (url.pathname.endsWith('/sync_simulation_session')) {
      assert.ok(user); const p = req.postDataJSON(); assert.equal(p.p_user_id, user.id);
      f.writes.push({ kind: 'simulation', user: user.id, payload: p });
      f.sessions.set(user.id + ':' + p.p_session_id, { user_id: user.id, payload: p.p_payload, updated_at: p.p_updated_at }); return json(null);
    }
    if (url.pathname === '/rest/v1/simulation_sessions') return json([...f.sessions.values()].filter(r => r.user_id === user?.id));
    if (url.pathname.endsWith('/sync_essay_document')) {
      if (f.offline) return route.abort();
      assert.ok(user); const p = req.postDataJSON(); assert.equal(p.p_user_id, user.id);
      f.writes.push({ kind: 'essay', user: user.id, payload: p });
      f.essays.set(user.id + ':' + p.p_topic_id, { user_id: user.id, topic_id: p.p_topic_id, content: p.p_content,
        elapsed_seconds: p.p_elapsed_seconds, status: p.p_status, updated_at: p.p_updated_at, submitted_at: p.p_submitted_at }); return json(null);
    }
    if (url.pathname === '/rest/v1/essay_documents') return json([...f.essays.values()].filter(r => r.user_id === user?.id));
    // Other services are empty fixtures and outside this diagnostic's assertions.
    return json([]);
  });
  const page = await context.newPage(); f.page = page;
  // Install before app scripts create timers; otherwise runFor cannot advance them.
  await page.clock.install();
  page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(10000);
  page.on('pageerror', e => f.errors.push(e.message));
  f.login = async (user = users[0]) => {
    await page.goto(base + '/entrar');
    await page.locator('input[name=email]').fill(user.email);
    await page.locator('input[name=password]').fill('Fixture-only-password');
    await page.locator('form[data-form=login] button[type=submit]').click(); await page.waitForURL('**/inicio');
    await page.waitForTimeout(200);
  };
  f.state = async (user = users[0]) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), stateKey(user));
  f.tick = async ms => { await page.clock.runFor(ms); await page.waitForTimeout(50); };
  return f;
}
async function check(name, run, width = 1440) {
  if (process.env.KAD_CASE && !new RegExp(process.env.KAD_CASE).test(name)) return;
  const f = await fixture(width); const started = Date.now();
  try { const detail = await run(f); assert.deepEqual(f.errors, []); results.push({ name, result: 'PASS', detail, errors: f.errors }); }
  catch (e) {
    const image = `${name.replaceAll(/[^a-z0-9-]/gi, '-')}.png`;
    await f.page.screenshot({ path: join(out, image), fullPage: true }).catch(() => {});
    results.push({ name, result: 'FAIL', error: e.message.split('Call log:')[0].trim(), detail: f.detail, errors: f.errors, screenshot: image });
  } finally {
    const r = results.at(-1); r.durationMs = Date.now() - started; r.externalRequestsBlocked = f.blocked; r.writes = f.writes.map(w => ({ kind: w.kind, user: w.user }));
    console.log(JSON.stringify(r)); await f.context.close();
  }
}
try {
  for (const width of [1440, 390]) await check(`questions-offline-retry-${width}`, async f => {
    const p = f.page; await f.login(); await p.goto(base + '/questoes/sessao?limit=2');
    await p.waitForFunction(() => document.querySelector('.options button') && !document.querySelector('fieldset')?.disabled);
    f.offline = true; await p.locator('[data-action=answer-question][data-alternative=B]').click();
    await p.locator('.explanation').waitFor(); await p.reload(); await p.locator('.explanation').waitFor();
    assert.equal(f.writes.filter(w => w.kind === 'answer').length, 0);
    f.offline = false;
    const sync = p.getByRole('button', { name: 'Sincronizar progresso' });
    const synchronize = () => width < 600 ? sync.tap() : sync.click();
    await synchronize(); await p.getByText('Progresso sincronizado com sua conta.', { exact: true }).waitFor();
    await p.mouse.move(0, 0);
    await synchronize();
    assert.equal(f.writes.filter(w => w.kind === 'answer').length, 1);
    await p.getByRole('button', { name: 'Próxima questão' }).click();
    await p.locator('[data-action=answer-question][data-alternative=A]').click();
    await p.getByRole('button', { name: 'Concluir sessão' }).click(); await p.waitForURL('**/perfil/desempenho');
    assert.equal(Object.keys((await f.state()).answers).length, 2);
    await f.login(users[1]); assert.equal(Object.keys((await f.state(users[1])).answers).length, 0);
    assert.deepEqual(f.errors, []); return { correctAndWrong: true, offlineReload: true, retryIdempotent: true, userIsolation: true };
  }, width);
  await check('questions-filters-favorites', async f => {
    const p = f.page; await p.goto(base + '/questoes/buscar'); await p.locator('.result-row').first().waitFor();
    assert.equal(await p.locator('.result-row').count(), 6);
    await p.getByLabel('Palavra-chave', { exact: true }).fill('Questão fictícia 4');
    await p.getByRole('button', { name: 'Buscar', exact: true }).click(); assert.equal(await p.locator('.result-row').count(), 1);
    const filtered = p.url(); await p.locator('[data-action=open-question]').click();
    await p.locator('[data-action=answer-question][data-alternative=B]').click(); await p.locator('.explanation').waitFor();
    await p.getByRole('button', { name: 'Adicionar aos favoritos', exact: true }).click();
    await p.reload(); await p.getByRole('button', { name: 'Remover dos favoritos', exact: true }).waitFor();
    await p.getByRole('button', { name: 'Voltar à busca', exact: true }).click(); assert.equal(p.url(), filtered);
    await p.getByRole('button', { name: 'Limpar filtros', exact: true }).click(); assert.equal(await p.locator('.result-row').count(), 6);
    await p.getByLabel('Palavra-chave', { exact: true }).fill('nada-na-fixture'); await p.getByRole('button', { name: 'Buscar', exact: true }).click();
    await p.getByText('Nenhuma questão encontrada', { exact: true }).waitFor(); assert.equal(await p.locator('.result-row').count(), 0);
    return { textFilter: true, favoritesReload: true, preserveFilter: true, emptyState: true };
  });
  await check('simulation-pause-resume-result', async f => {
    const p = f.page; await f.login(); await p.goto(base + '/simulados/configurar');
    await p.locator('[data-form=simulation-config]').waitFor(); await p.locator('[name=shuffleQuestions]').uncheck();
    await p.getByRole('button', { name: 'Iniciar simulado', exact: true }).click(); await p.waitForURL('**/simulados/em-andamento');
    await p.locator('[data-action=answer-simulation]').first().waitFor();
    await f.tick(3100);
    const before = (await f.state()).simulations.current; assert.ok(before.remainingSeconds < 1200);
    await p.locator('[data-action=answer-simulation][data-alternative=B]').click(); await p.getByRole('button', { name: 'Pausar', exact: true }).click();
    const paused = (await f.state()).simulations.current; await f.tick(5100);
    assert.equal((await f.state()).simulations.current.remainingSeconds, paused.remainingSeconds);
    await p.reload(); await p.getByRole('button', { name: 'Retomar', exact: true }).waitFor();
    assert.equal((await f.state()).simulations.current.answers['fixture-q-1'], 'B');
    await p.getByRole('button', { name: 'Retomar', exact: true }).click(); await f.tick(2100);
    await p.getByRole('button', { name: 'Próxima', exact: true }).click(); await p.locator('[data-action=answer-simulation][data-alternative=A]').click();
    f.paid = false; await p.getByRole('button', { name: 'Finalizar', exact: true }).click(); await p.waitForURL('**/simulados/resultado');
    await p.getByText('1 acerto, 1 erro e 3 questões em branco.', { exact: true }).waitFor();
    assert.equal((await f.state()).simulations.history.length, 1);
    await p.reload(); assert.equal((await f.state()).simulations.history.length, 1);
    await p.goto(base + '/simulados/configurar'); await p.getByText('Este recurso exige uma assinatura válida', { exact: true }).waitFor();
    assert.equal((await f.state()).simulations.history.length, 1);
    return { timer: true, pause: true, reloadAnswer: true, resume: true, result: true, expiredCannotCreate: true, existingCanFinish: true };
  });
  await check('simulation-paused-answer', async f => {
    const p = f.page; await p.goto(base + '/simulados'); await p.getByRole('button', { name: 'Simulado rápido', exact: true }).click();
    await p.locator('[data-action=answer-simulation]').first().waitFor(); await p.getByRole('button', { name: 'Pausar', exact: true }).click();
    const btn = p.locator('[data-action=answer-simulation]').first();
    assert.equal(await btn.isEnabled(), false);
    const before = (await f.state(null)).simulations.current;
    // Exercise the handler too, even after someone removes the disabled attribute.
    await btn.evaluate(button => { button.disabled = false; button.click(); });
    await f.tick(5100);
    assert.deepEqual((await f.state(null)).simulations.current, before);
    await p.reload(); await p.getByRole('button', { name: 'Retomar', exact: true }).waitFor();
    assert.equal(await p.locator('[data-action=answer-simulation]').first().isEnabled(), false);
    await p.getByRole('button', { name: 'Retomar', exact: true }).click();
    await p.locator('[data-action=answer-simulation][data-alternative=A]').click();
    assert.equal(Object.keys((await f.state(null)).simulations.current.answers).length, 1);
    return { disabled: true, handlerGuard: true, pausedReload: true, resume: true };

  });
  await check('essay-local-save-review-topic-isolation', async f => {
    const p = f.page; const topic = 'tribunais-acesso-digital'; const other = 'pf-desinformacao-seguranca';
    await p.goto(base + '/redacao?topic=' + topic); await p.locator('[data-essay-input]').waitFor();
    await p.locator('[data-essay-input]').fill('Texto fictício do primeiro tema.'); await f.tick(6100);
    await p.getByRole('button', { name: 'Concluir prática', exact: true }).click(); await p.waitForURL('**/redacao?topic=**&stage=review');
    const saved = (await f.state(null)).essays[topic]; assert.equal(saved.content, 'Texto fictício do primeiro tema.'); assert.ok(saved.elapsedSeconds >= 5);
    await f.tick(6100); assert.equal((await f.state(null)).essays[topic].elapsedSeconds, saved.elapsedSeconds);
    await p.reload(); await p.getByText(saved.content, { exact: true }).waitFor();
    await p.goto(base + '/redacao?topic=' + other); await p.locator('[data-essay-input]').waitFor();
    assert.equal(await p.locator('[data-essay-input]').inputValue(), '');
    await p.locator('[data-essay-input]').fill('Texto fictício do segundo tema.'); await p.reload();
    assert.equal(await p.locator('[data-essay-input]').inputValue(), 'Texto fictício do segundo tema.');
    await p.goto(base + '/redacao?topic=' + topic); await p.locator('[data-essay-input]').waitFor();
    assert.equal(await p.locator('[data-essay-input]').inputValue(), saved.content);
    return { saved: true, reload: true, reviewTimerStopped: true, themesIsolated: true };
  });
  await check('essay-account-sync', async f => {
    const p = f.page; await f.login(); await p.goto(base + '/redacao?topic=tribunais-acesso-digital');
    await p.locator('[data-essay-input]').fill('Texto fictício que deve sincronizar.');
    await p.getByRole('button', { name: 'Concluir prática', exact: true }).click(); await p.waitForTimeout(1500);
    const writes = f.writes.filter(w => w.kind === 'essay');
    assert.ok(writes.length > 0, 'sync_essay_document must receive the saved draft');
    assert.equal(writes.at(-1).payload.p_topic_id, 'tribunais-acesso-digital');
    assert.equal(writes.at(-1).payload.p_content, 'Texto fictício que deve sincronizar.');
    await p.evaluate(key => localStorage.removeItem(key), stateKey(users[0]));
    await p.reload(); await p.getByText('Texto fictício que deve sincronizar.', { exact: true }).waitFor();
    await f.login(users[1]);
    await p.goto(base + '/redacao?topic=tribunais-acesso-digital');
    assert.equal(await p.locator('[data-essay-input]').inputValue(), '');
    return { rpcValidated: true, recoveredFromRemoteFixture: true, accountIsolation: true };

  });
  await check('essay-offline-recovery', async f => {
    const p = f.page; const topic = 'tribunais-acesso-digital';
    await f.login(); f.offline = true;
    await p.goto(base + '/redacao?topic=' + topic);
    assert.equal(await p.getByText('Rascunho sincronizado com sua conta KAD.', { exact: true }).count(), 0);
    await p.locator('[data-essay-input]').fill('Rascunho offline fictício.');
    await p.getByRole('button', { name: 'Concluir prática', exact: true }).click();
    await f.tick(1500);
    assert.equal(f.writes.filter(w => w.kind === 'essay').length, 0);
    assert.equal((await f.state()).essays[topic].content, 'Rascunho offline fictício.');
    f.offline = false; await p.reload(); await p.getByText('Rascunho offline fictício.', { exact: true }).waitFor();
    await p.waitForTimeout(1000);
    assert.ok(f.writes.some(w => w.kind === 'essay' && w.payload.p_content === 'Rascunho offline fictício.'));
    return { localPreserved: true, retryAfterReload: true, noFalseSyncClaim: true };
  });
  for (const topic of ['missing-fixture', '__proto__', 'constructor', 'prototype', 'toString']) await check('essay-invalid-' + topic, async f => {
    const p = f.page; await p.goto(base + '/redacao?topic=' + encodeURIComponent(topic)); await p.locator('main').waitFor();
    await f.tick(6100);
    f.detail = { essays: (await f.state(null)).essays ?? {}, objectPrototypeElapsed: await p.evaluate(() => Object.prototype.elapsedSeconds ?? null),
      inheritedFunctionElapsed: await p.evaluate(() => ({ constructor: Object.elapsedSeconds ?? null, toString: Object.prototype.toString.elapsedSeconds ?? null })), errors: f.errors };
    assert.deepEqual(Object.keys(f.detail.essays), [], 'Invalid theme creates a draft/timer');
    assert.equal(f.detail.objectPrototypeElapsed, null, 'Invalid theme mutates Object.prototype');
    assert.deepEqual(f.detail.inheritedFunctionElapsed, { constructor: null, toString: null }, 'Invalid theme mutates inherited functions');
    assert.deepEqual(f.errors, []);
  });
} finally {
  await browser.close();
  await writeFile(join(out, 'report.json'), JSON.stringify({ source: 'current local build', base,
    isolated: 'All non-local requests fulfilled with fixtures or aborted. No remote database writes.', results }, null, 2));
  console.log(JSON.stringify({ pass: results.filter(r => r.result === 'PASS').length, fail: results.filter(r => r.result === 'FAIL').length, report: join(out, 'report.json') }));
}


if (results.some(result => result.result === 'FAIL')) process.exitCode = 1;
