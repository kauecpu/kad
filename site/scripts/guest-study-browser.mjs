// Real staging catalog, isolated visitor profile. No remote mutations are allowed.
// Required: KAD_APPROVED_PACKAGE. Optional: KAD_TEST_URL, KAD_TEST_OUTPUT, PLAYWRIGHT_MODULE_PATH.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.KAD_TEST_URL ?? 'http://127.0.0.1:5200';
assert.ok(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base), 'test only against a local Site');
const staging = 'https://npaoyezfwmgauirrlyog.supabase.co';
assert.ok(process.env.KAD_APPROVED_PACKAGE, 'supply the approved JSONL for a read-only comparison');
const approvedText = await readFile(process.env.KAD_APPROVED_PACKAGE, 'utf8');
const approved = approvedText.trim().split(/\r?\n/).map(line => JSON.parse(line));
const output = resolve(process.env.KAD_TEST_OUTPUT ?? '../output/guest-study');
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const checkFields = ['statement', 'alternatives', 'correct', 'board', 'year', 'discipline', 'subject', 'topic'];
const fieldValue = (q, field) => field === 'alternatives' ? q.alternatives.map(a => ({ id: a.id, text: a.text })) : q[field];
const digest = q => hash(Object.fromEntries(checkFields.map(field => [field, fieldValue(q, field)])));
const report = { testedAt: new Date().toISOString(), base, project: 'npaoyezfwmgauirrlyog', approvedPackageSha256: hash(approvedText), catalog: [], passed: [], screenshots: [], remoteWritesAttempted: [], pageErrors: [] };
const browser = await chromium.launch({ headless: true });
let context;
let page;
let rows = [];
let mode = 'real';
let releaseCatalog;
const delayedCatalog = new Promise(resolveDelay => { releaseCatalog = resolveDelay; });
const note = name => { report.passed.push(name); console.log(`PASS ${name}`); };
const ready = async () => { await page.locator('.result-row').first().waitFor(); };
const search = async () => { await page.getByRole('button', { name: 'Buscar', exact: true }).click(); };
const clear = async () => { await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click(); };
const advanced = async () => { if (!(await page.locator('.filter-disclosure').getAttribute('open') !== null)) await page.locator('.filter-disclosure summary').click(); };
const chooseStatus = async status => { await advanced(); await page.getByLabel('Situação', { exact: true }).selectOption(status); await search(); };
const count = async expected => { await page.getByRole('heading', { name: `${expected} ${expected === 1 ? 'questão' : 'questões'}`, exact: true }).waitFor(); assert.equal(await page.locator('.result-row').count(), expected); };
const screenshot = async name => { await page.screenshot({ path: join(output, `${name}.png`), fullPage: true }); report.screenshots.push(`${name}.png`); };
const questionNumber = n => {
  const entry = approved.find(q => q.data.canonicalQuestion.provenances.some(p => p.questionNumber === n));
  assert.ok(entry, `approved question ${n}`);
  const row = rows.find(q => q.id === entry.data.id);
  assert.ok(row, `published question ${n}`);
  assert.equal(digest(row), digest(entry.data), `question ${n} must match approved study content`);
  return row;
};
const assertVisibleQuestion = async q => {
  assert.equal(await page.locator('.question-statement').textContent(), q.statement);
  for (const a of q.alternatives) assert.equal(await page.locator(`[data-action="answer-question"][data-alternative="${a.id}"] > span:nth-child(2)`).textContent(), a.text);
};

try {
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  context.on('page', opened => opened.on('pageerror', error => report.pageErrors.push(error.message)));
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === base) return route.continue();
    if (url.origin !== staging || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      report.remoteWritesAttempted.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort();
    }
    if (url.pathname === '/rest/v1/questions') {
      assert.equal(url.searchParams.get('publication_status'), 'eq.published');
      if (mode === 'delayed') await delayedCatalog;
      if (mode === 'failed') return route.abort('internetdisconnected');
      if (mode === 'empty') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.continue();
  });
  page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on('response', async response => {
    if (new URL(response.url()).pathname === '/rest/v1/questions' && response.ok() && mode === 'real') rows = await response.json();
  });
  await page.goto(`${base}/questoes/buscar`);
  await ready();
  assert.ok(rows.length >= 10, 'real catalog response received');
  await count(rows.length);
  report.catalog = rows.map(q => {
    const entry = approved.find(item => item.data.id === q.id);
    return { id: q.id, number: entry?.data.canonicalQuestion.provenances[0].questionNumber,
      publishedContentSha256: digest(q), approvedContentSha256: entry ? digest(entry.data) : null,
      differences: entry ? checkFields.filter(field => JSON.stringify(fieldValue(q, field)) !== JSON.stringify(fieldValue(entry.data, field))) : ['not-in-approved-package'] };
  });
  const q44 = questionNumber(44), q42 = questionNumber(42), q53 = questionNumber(53);
  note('real public catalog loaded; published content compared to approved package');
  await advanced();
  for (const [label, field] of [['Banca', 'board'], ['Ano', 'year'], ['Disciplina', 'discipline'], ['Matéria', 'subject'], ['Assunto', 'topic']]) {
    const options = await page.getByLabel(label, { exact: true }).locator('option').evaluateAll(els => els.map(el => el.value).filter(Boolean).sort());
    assert.deepEqual(options, [...new Set(rows.map(q => String(q[field])))].sort());
    await page.getByLabel(label, { exact: true }).selectOption(String(q44[field]));
  }
  await page.getByLabel('Palavra-chave').fill('numpy as np valorAplicado');
  await search();
  await count(1);
  const filteredUrl = page.url();
  note('text + board + year + discipline + subject + topic, with catalog-derived options');
  await page.locator(`[data-action="open-question"][data-question-id="${q44.id}"]`).click();
  await assertVisibleQuestion(q44);
  await page.locator(`[data-action="answer-question"][data-alternative="${q44.correct}"]`).dblclick();
  await page.getByText('Resposta correta', { exact: true }).waitFor();
  assert.equal(await page.locator('.options button:disabled').count(), q44.alternatives.length);
  await page.getByRole('button', { name: 'Adicionar aos favoritos', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar à busca', exact: true }).click();
  assert.equal(page.url(), filteredUrl);
  await clear(); await count(rows.length);
  note('correct answer, repeated click guarded, favorite and return preserving filters');

  await advanced();
  await page.getByLabel('Matéria', { exact: true }).selectOption(q42.subject);
  await chooseStatus('unanswered');
  await count(2);
  await page.locator(`[data-action="open-question"][data-question-id="${q42.id}"]`).click();
  await assertVisibleQuestion(q42);
  const wrong = q42.alternatives.find(a => a.id !== q42.correct).id;
  await page.locator(`[data-action="answer-question"][data-alternative="${wrong}"]`).click();
  await page.getByText(`Resposta incorreta · gabarito ${q42.correct}`, { exact: true }).waitFor();
  await assertVisibleQuestion(q42);
  await page.getByRole('button', { name: 'Próxima questão', exact: true }).click();
  await assertVisibleQuestion(q53);
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await assertVisibleQuestion(q42);
  note('unanswered session keeps feedback and supports next/previous');

  await page.getByRole('button', { name: 'Voltar à busca', exact: true }).click();
  await clear();
  for (const [status, expected] of [['answered', 2], ['unanswered', rows.length - 2], ['correct', 1], ['wrong', 1], ['favorites', 1]]) {
    await chooseStatus(status); await count(expected);
  }
  note('answered/unanswered/correct/wrong/favorites filters');
  await page.reload(); await ready(); await count(1);
  await page.close(); page = await context.newPage();
  await page.goto(`${base}/questoes/buscar`); await ready();
  await chooseStatus('favorites'); await count(1);
  await page.locator(`[data-action="open-question"][data-question-id="${q44.id}"]`).click();
  await page.getByText('Resposta correta', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Remover dos favoritos', exact: true }).waitFor();
  note('answer and favorite survive reload and closing/reopening a tab');

  await page.getByRole('link', { name: 'Questões', exact: true }).click();
  await page.getByRole('button', { name: /^Erradas / }).click();
  await page.locator(`[data-action="open-question"][data-question-id="${q42.id}"]`).click();
  await page.getByText(`Resposta incorreta · gabarito ${q42.correct}`, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Voltar à revisão', exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get('tipo'), 'erradas');
  note('error review opens saved answer and returns to review');

  await page.goto(`${base}/questoes/buscar`); await ready();
  await page.getByLabel('Palavra-chave').fill('texto-que-nao-existe-na-amostra-2026');
  await search(); await count(0);
  await page.getByText('Nenhuma questão encontrada', { exact: true }).waitFor();
  await clear(); await count(rows.length);
  await page.getByLabel('Palavra-chave').fill(''); await search(); await count(rows.length);
  note('empty text, no matches and clear filters');

  await page.locator(`[data-action="open-question"][data-question-id="${q53.id}"]`).click();
  await context.setOffline(true);
  await page.locator(`[data-action="answer-question"][data-alternative="${q53.correct}"]`).click();
  await page.getByText('Resposta correta', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Adicionar aos favoritos', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar à busca', exact: true }).click();
  await chooseStatus('favorites'); await count(2);
  await context.setOffline(false);
  await page.reload(); await ready(); await count(2);
  note('network loss after catalog load: answer, favorite, search, reconnect and reload');

  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      await page.getByRole('button', { name: theme === 'dark' ? 'Ativar tema escuro' : 'Ativar tema claro', exact: true }).click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `search overflow ${width}/${theme}`);
      await screenshot(`search-${width}-${theme}`);
      await page.locator(`[data-action="open-question"][data-question-id="${q44.id}"]`).click();
      await assertVisibleQuestion(q44);
      if (width === 390) {
        await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
        await page.locator(`[data-action="answer-question"][data-alternative="${q44.correct}"]`).click();
        await page.getByText('Resposta correta', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Remover dos favoritos', exact: true }).click();
        await page.getByRole('button', { name: 'Adicionar aos favoritos', exact: true }).click();
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `study overflow ${width}/${theme}`);
      await screenshot(`study-${width}-${theme}`);
      await page.getByRole('button', { name: 'Voltar à busca', exact: true }).click();
    }
  }
  await page.getByLabel('Palavra-chave').press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'discipline');
  note('desktop/tablet/mobile, both themes, reduced motion and keyboard focus');

  mode = 'failed'; await page.reload();
  await page.getByText('Não foi possível carregar as questões', { exact: true }).waitFor();
  assert.equal(await page.locator('.result-row').count(), 0);
  mode = 'delayed'; await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await page.getByText('Carregando o catálogo de questões…', { exact: true }).waitFor();
  assert.equal(await page.locator('.result-row').count(), 0);
  mode = 'real'; releaseCatalog(); await ready(); await count(2);
  note('simulated initial connection failure + delayed real retry; no demo leakage');
  mode = 'empty'; await page.reload();
  await page.getByText('Nenhuma questão disponível', { exact: true }).waitFor();
  assert.equal(await page.locator('.result-row').count(), 0);
  note('simulated empty catalog has an honest empty state');
  mode = 'real'; await page.reload(); await ready(); await count(2);
  assert.deepEqual(report.remoteWritesAttempted, []);
  assert.deepEqual(report.pageErrors, []);
  note('no production requests, remote mutations or page errors');
} catch (error) {
  report.failure = error.message;
  if (page && !page.isClosed()) await screenshot('failure');
  process.exitCode = 1;
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  console.log(JSON.stringify({ passed: report.passed.length, catalogCount: report.catalog.length, differences: report.catalog.filter(q => q.differences.length).map(q => ({ number: q.number, fields: q.differences })), failure: report.failure ?? null, output }, null, 2));
}
