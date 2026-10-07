import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore, recordAnswer } from '../src/core/store.ts';
import { filterQuestions } from '../src/core/utils.ts';
import { getCatalog, replacePublishedCatalog, resetCatalog } from '../src/data/catalog.ts';
import { questionCatalogStatusView, questionsForSession, questionSessionView, reviewView, searchView } from '../src/views/questions.ts';
import type { UiState } from '../src/types/domain.ts';

test('combined subject and year filters select the same search and session questions', () => {
  resetCatalog();
  const sample = getCatalog().questions[0];
  const rows = [
    { ...sample, id: 'first', year: 2021, subject: 'SQL' },
    { ...sample, id: 'other-year', year: 2022, subject: 'SQL' },
    { ...sample, id: 'other-subject', year: 2021, subject: 'Python' },
  ];
  replacePublishedCatalog({ questions: rows });
  const params = { year: '2021', subject: 'SQL', board: sample.board, discipline: sample.discipline, topic: sample.topic };
  assert.deepEqual(filterQuestions(rows, params).map(q => q.id), ['first']);
  assert.deepEqual(questionsForSession(params, createStore(undefined).getState()).map(q => q.id), ['first']);
  resetCatalog();
});

test('answered, unanswered, correct, wrong and favorites use the visitor records', () => {
  resetCatalog();
  const rows = getCatalog().questions.slice(0, 3);
  replacePublishedCatalog({ questions: rows });
  const s = createStore(undefined);
  s.update(draft => {
    recordAnswer(draft, rows[0], rows[0].correct);
    recordAnswer(draft, rows[1], rows[1].correct === 'A' ? 'B' : 'A');
    draft.favorites = [rows[2].id];
  });
  for (const [status, expected] of Object.entries({ answered: rows.slice(0, 2), unanswered: [rows[2]], correct: [rows[0]], wrong: [rows[1]], favorites: [rows[2]] })) {
    assert.deepEqual(questionsForSession({ status }, s.getState()), expected);
  }
  assert.ok(reviewView(undefined, s.getState()).content.includes(rows[2].id));
  resetCatalog();
});

test('search exposes catalog-derived filters and an honest empty state', () => {
  resetCatalog();
  const view = searchView(createStore(undefined).getState());
  for (const field of ['year', 'subject', 'topic']) assert.ok(view.content.includes(`name="${field}"`));
  assert.match(view.content, /Limpar filtros/);
  assert.match(view.content, /Respondidas/);
  replacePublishedCatalog({ questions: [] });
  const empty = searchView(createStore(undefined).getState());
  assert.match(empty.content, /Nenhuma questão disponível/);
  assert.doesNotMatch(empty.content, /Seu banco inteiro está pronto|Praticar todas/);
  resetCatalog();
});

test('a result opens its position in the filtered session and can return to the same search', () => {
  resetCatalog();
  const rows = getCatalog().questions.slice(0, 3);
  replacePublishedCatalog({ questions: rows });
  const state = createStore(undefined).getState();
  const ui = { questionIndex: 0, visitedQuestionIds: new Set<string>() } as UiState;
  const view = questionSessionView(state, { start: rows[1].id, year: String(rows[1].year) }, ui);
  assert.ok(view.content.includes(`data-question-id="${rows[1].id}"`));
  assert.match(view.content, /Voltar à busca/);
  assert.ok(view.content.includes(`/questoes/buscar?year=${rows[1].year}`));
  resetCatalog();
});

test('loading and connection failure do not present demo results as published questions', () => {
  assert.match(questionCatalogStatusView({ connection: 'connecting', content: 'loading' })!.content, /Carregando o catálogo/);
  const failure = questionCatalogStatusView({ connection: 'error', content: 'unavailable' })!.content;
  assert.match(failure, /retry-question-catalog/);
  assert.match(failure, /registros neste navegador continuam preservados/);
  assert.equal(questionCatalogStatusView({ connection: 'connected', content: 'remote' }), null);
  assert.equal(questionCatalogStatusView({ connection: 'connected', content: 'empty' }), null);
});

test('guest answers and favorites persist and never become an authenticated owner history', () => {
  resetCatalog();
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const s = createStore(storage);
  const question = getCatalog().questions[0];
  s.update(draft => { recordAnswer(draft, question, question.correct); draft.favorites = [question.id]; });
  const reopened = createStore(storage);
  assert.equal(reopened.getState().answers[question.id].selected, question.correct);
  assert.deepEqual(reopened.getState().favorites, [question.id]);
  reopened.switchOwner('test-account');
  assert.deepEqual(reopened.getState().answers, {});
  assert.deepEqual(reopened.getState().favorites, []);
  reopened.switchOwner(null);
  assert.equal(reopened.getState().answers[question.id].selected, question.correct);
  assert.deepEqual(reopened.getState().favorites, [question.id]);
});

test('text search matches an ordinary phrase across PDF line breaks', () => {
  resetCatalog();
  const sample = { ...getCatalog().questions[0], statement: 'Aplicação de\nrecursos financeiros\tno banco.' };
  assert.deepEqual(filterQuestions([sample], { keyword: 'APLICACAO DE RECURSOS' }), [sample]);
});
