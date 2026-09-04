// Local-only browser integration. Every non-local request is intercepted; no remote data is written.
// Start site dev on 127.0.0.1:5193, then run with PLAYWRIGHT_MODULE_PATH if Playwright is external.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { QUESTIONS } from '../../data/questions.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = 'http://127.0.0.1:5193';
const staging = 'https://npaoyezfwmgauirrlyog.supabase.co';
const users = ['a', 'b'].map((name, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  email: `${name}@example.test`, aud: 'authenticated', role: 'authenticated', user_metadata: { name: `Fixture ${name}` } }));
const questions = QUESTIONS.slice(0, 3);
const rows = new Map(users.map(u => [u.id, new Map()]));
let disconnected = false;
let writes = 0;
const errors = [];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const json = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.origin === base) {
      if (url.pathname === '/api/public-config') return json({ environment: 'staging', url: staging, publishableKey: 'sb_publishable_isolated_fixture' });
      return route.continue();
    }
    if (url.origin !== staging) return route.abort();
    const user = users.find(u => request.headers().authorization === `Bearer fixture-${u.id}`);
    if (url.pathname.endsWith('/token')) {
      const login = users.find(u => u.email === request.postDataJSON().email);
      assert.ok(login, 'only isolated accounts are accepted');
      return json({ access_token: `fixture-${login.id}`, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user: login });
    }
    if (url.pathname.endsWith('/logout')) return json({});
    if (url.pathname.endsWith('/user')) return json(user);
    if (url.pathname.endsWith('/questions')) return json(questions);
    if (url.pathname.endsWith('/rpc/record_question_attempt')) {
      if (disconnected) return route.abort();
      assert.ok(user, 'write must carry its owner session');
      const payload = request.postDataJSON();
      assert.deepEqual(Object.keys(payload).sort(), ['p_question_id', 'p_selected']);
      const question = questions.find(q => q.id === payload.p_question_id);
      assert.ok(question);
      rows.get(user.id).set(question.id, { question_id: question.id, subject: question.subject, selected: payload.p_selected,
        is_correct: payload.p_selected === question.correct, answered_at: new Date().toISOString() });
      writes++;
      return json({});
    }
    if (url.pathname.endsWith('/question_attempts')) {
      if (disconnected) return route.abort();
      assert.ok(user);
      assert.equal(url.searchParams.get('user_id'), `eq.${user.id}`);
      return json([...rows.get(user.id).values()]);
    }
    // Unrelated services use empty isolated responses; their business rules are not tested here.
    return json([]);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(15_000);
  page.on('pageerror', error => errors.push(error.message));
  const login = async index => {
    await page.goto(`${base}/entrar`);
    await page.locator('input[name="email"]').fill(users[index].email);
    await page.locator('input[name="password"]').fill('Fixture-only-password');
    await page.locator('form[data-form="login"] button[type="submit"]').click();
    await page.waitForURL('**/inicio');
  };
  const study = async () => {
    await page.goto(`${base}/questoes/sessao?limit=2`);
  await page.waitForFunction(() => document.querySelector('.options button') && !document.querySelector('fieldset')?.disabled);
  };
  await login(0);
  await study();
  disconnected = true;
  await page.locator(`[data-action="answer-question"][data-alternative="${questions[0].correct}"]`).click();
  await page.locator('.explanation').waitFor();
  await page.getByText('Progresso local preservado. Entre na conta ou tente sincronizar novamente.', { exact: true }).waitFor();
  await page.reload();
  await page.locator('.explanation').waitFor();
  assert.equal(writes, 0);
  disconnected = false;
  await page.getByRole('button', { name: 'Sincronizar progresso' }).click();
  await page.getByText('Progresso sincronizado com sua conta.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Sincronizar progresso' }).click();
  assert.equal(writes, 1);
  await page.getByRole('button', { name: 'Próxima questão' }).click();
  await page.locator(`[data-action="answer-question"][data-alternative="${questions[1].correct}"]`).click();
  await page.getByRole('button', { name: 'Concluir sessão' }).click();
  await page.waitForURL('**/perfil/desempenho');
  assert.match(await page.locator('main').innerText(), /2/);
  await page.goto(`${base}/perfil`);
  await page.locator('[data-action="sign-out"]').click();
  await page.waitForURL(base + '/');
  await login(1);
  await study();
  assert.equal(await page.locator('.explanation').count(), 0);
  await page.goto(`${base}/perfil`);
  await page.locator('[data-action="sign-out"]').click();
  await page.waitForURL(base + '/');
  await login(0);
  await study();
  await page.locator('.explanation').waitFor();
  assert.equal(rows.get(users[0].id).size, 2);
  assert.equal(rows.get(users[1].id).size, 0);
  await page.locator('.comments-disclosure summary').click();
  await page.locator('textarea[name="comment"]').fill('Rascunho isolado, sem envio.');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(250);
  assert.equal(await page.locator('textarea[name="comment"]').inputValue(), 'Rascunho isolado, sem envio.');
  assert.equal(await page.locator('textarea[name="comment"]').evaluate(el => el === document.activeElement), true);
  await page.goto(`${base}/questoes/buscar?board=fixture-no-match`);
  assert.equal(await page.locator('[data-action="answer-question"]').count(), 0);
  await page.goBack();
  await page.locator('.explanation').waitFor();
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}/${theme} overflow`);
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '200% text overflow');
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.activeElement !== document.body));
  assert.deepEqual(errors, []);
  console.log('PASS: isolated Chromium login, answer, offline reload, retry, result, logout/login, account isolation, widths/themes, enlarged text, keyboard. No physical-device validation.');
} finally {
  await browser.close();
}
