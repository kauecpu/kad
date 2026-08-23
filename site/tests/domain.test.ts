import assert from 'node:assert/strict';
import test from 'node:test';

import { createStore, recordAnswer } from '../src/core/store.ts';
import { filterQuestions, matchesPack, questionsPerformance } from '../src/core/utils.ts';
import { matchRoute, shouldOpenStudyHome } from '../src/core/router.ts';
import { questionSessionView, questionsIndexView } from '../src/views/questions.ts';
import { createSimulation, simulationScore, simulationsView } from '../src/views/simulations.ts';
import { getCatalog } from '../src/data/catalog.ts';
import type { StorageLike } from '../src/types/domain.ts';

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('estado local registra resposta, atividade e restaura dados persistidos', () => {
  const storage = memoryStorage();
  const first = createStore(storage);
  const question = getCatalog().questions[0];
  assert.ok(question);

  first.update((draft) => recordAnswer(draft, question, question.correct));
  const restored = createStore(storage).getState();

  assert.equal(restored.answers[question.id].isCorrect, true);
  assert.equal(questionsPerformance(restored.answers).accuracy, 100);
  assert.ok(Object.values(restored.activityByDate).flat().includes(question.id));
});
test('busca combina palavra-chave, disciplina e pacote sem misturar escopos', () => {
  const { questions, packs } = getCatalog();
  const pack = packs.find((item) => questions.some((question) => matchesPack(question, item)));
  assert.ok(pack);

  const candidates = filterQuestions(questions, { pack });
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((question) => matchesPack(question, pack)));

  const question = candidates[0];
  assert.ok(question);
  assert.deepEqual(
    filterQuestions(candidates, { discipline: question.discipline, keyword: question.board }),
    candidates.filter(
      (item) => item.discipline === question.discipline && item.board === question.board,
    ),
  );
});

test('simulado respeita quantidade, recebe respostas e calcula resultado', () => {
  const session = createSimulation({ questionCount: 5, durationMinutes: 10, shuffleQuestions: false });
  assert.ok(session);
  assert.equal(session.questionIds.length, 5);
  assert.equal(session.remainingSeconds, 600);

  const questions = getCatalog().questions;
  for (const id of session.questionIds.slice(0, 3)) {
    const question = questions.find((item) => item.id === id);
    assert.ok(question);
    session.answers[id] = question.correct;
  }
  const score = simulationScore(session);
  assert.deepEqual(
    { total: score.total, answered: score.answered, correct: score.correct, blank: score.blank },
    { total: 5, answered: 3, correct: 3, blank: 2 },
  );
});

test('catálogos omitem métricas vazias até existir atividade real', () => {
  const state = createStore(memoryStorage()).getState();

  assert.doesNotMatch(questionsIndexView(state).content, /Seu progresso nas questões/);
  assert.doesNotMatch(simulationsView(state).content, /Resumo dos simulados/);

  const question = getCatalog().questions[0];
  assert.ok(question);
  recordAnswer(state, question, question.correct);
  assert.match(questionsIndexView(state).content, /Seu progresso nas questões/);
});

test('sessão identifica avanço sem resposta como questão pulada', () => {
  const state = createStore(memoryStorage()).getState();
  const ui = { questionIndex: 0, visitedQuestionIds: new Set<string>() };

  assert.match(questionSessionView(state, { limit: '2' }, ui).content, /Pular questão/);
  ui.questionIndex = 1;
  assert.match(questionSessionView(state, { limit: '2' }, ui).content, /Questão 1, pulada/);
});

test('roteador reconhece parâmetros sem aceitar rotas de tamanhos diferentes', () => {
  assert.deepEqual(matchRoute('/concursos/:id', '/concursos/tj-sp'), { id: 'tj-sp' });
  assert.equal(matchRoute('/concursos/:id', '/concursos/tj-sp/edital'), null);
});

test('raiz abre o estudo apenas para conta ou visitante que já iniciou', () => {
  assert.equal(shouldOpenStudyHome('/', { auth: { mode: 'visitor' }, preferences: { hasStarted: false } }), false);
  assert.equal(shouldOpenStudyHome('/', { auth: { mode: 'visitor' }, preferences: { hasStarted: true } }), true);
  assert.equal(shouldOpenStudyHome('/', { auth: { mode: 'authenticated' }, preferences: { hasStarted: false } }), true);
  assert.equal(shouldOpenStudyHome('/entrar', { auth: { mode: 'authenticated' }, preferences: { hasStarted: true } }), false);
});
