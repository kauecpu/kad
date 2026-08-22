import assert from 'node:assert/strict';
import test from 'node:test';

import { createStore, recordAnswer } from '../src/core/store.js';
import { filterQuestions, matchesPack, questionsPerformance } from '../src/core/utils.js';
import { matchRoute, shouldOpenStudyHome } from '../src/core/router.js';
import { createSimulation, simulationScore } from '../src/views/simulations.js';
import { getCatalog } from '../src/data/catalog.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('estado local registra resposta, atividade e restaura dados persistidos', () => {
  const storage = memoryStorage();
  const first = createStore(storage);
  const question = getCatalog().questions[0];

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
    session.answers[id] = question.correct;
  }
  const score = simulationScore(session);
  assert.deepEqual(
    { total: score.total, answered: score.answered, correct: score.correct, blank: score.blank },
    { total: 5, answered: 3, correct: 3, blank: 2 },
  );
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
