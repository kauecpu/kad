import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterTrailTracks,
  parseTrailSelection,
  resolveTrailSelection,
  trailLevelMetrics,
  trailMetrics,
  trailSelectionStorageKey,
  type TrailCatalog,
} from '../lib/trail-journey.ts';
import { QUESTIONS } from '../data/questions.ts';
import { createTrailLevels } from '../lib/trails.ts';
import type { AnswerRecord } from '../types/index.ts';

const catalog: TrailCatalog = {
  concurso: { tribunais: [1, 2] },
  discipline: { portugues: [1] },
};

const questions = QUESTIONS.slice(0, 2);

function answer(questionId: string, isCorrect: boolean): AnswerRecord {
  const question = questions.find((item) => item.id === questionId) ?? questions[0];
  return {
    questionId,
    subject: question.subject,
    selected: isCorrect ? 'A' : 'B',
    isCorrect,
    answeredAt: '2026-08-16T12:00:00.000Z',
  };
}

test('usuário sem meta ou retomada precisa escolher uma trilha', () => {
  assert.equal(resolveTrailSelection({ stored: null, catalog }), null);
});

test('meta válida recomenda uma trilha e retomada válida tem prioridade', () => {
  assert.deepEqual(
    resolveTrailSelection({ stored: null, recommendedTrackId: 'tribunais', catalog }),
    { mode: 'concurso', trackId: 'tribunais', level: 1 }
  );
  assert.deepEqual(
    resolveTrailSelection({
      stored: { mode: 'discipline', trackId: 'portugues', level: 1 },
      recommendedTrackId: 'tribunais',
      catalog,
    }),
    { mode: 'discipline', trackId: 'portugues', level: 1 }
  );
});

test('retomada inválida volta ao primeiro nível disponível', () => {
  assert.deepEqual(
    resolveTrailSelection({
      stored: { mode: 'concurso', trackId: 'tribunais', level: 9 },
      catalog,
    }),
    { mode: 'concurso', trackId: 'tribunais', level: 1 }
  );
  assert.equal(parseTrailSelection('{"mode":"concurso","trackId":"","level":0}'), null);
});

test('persistência usa uma chave diferente para cada usuário', () => {
  assert.notEqual(trailSelectionStorageKey('usuario-a'), trailSelectionStorageKey('usuario-b'));
  assert.match(trailSelectionStorageKey('guest'), /:guest$/);
});

test('busca vazia preserva opções e busca sem resultado retorna lista vazia', () => {
  const tracks = [{ name: 'Tribunais' }, { name: 'Língua Portuguesa' }];
  assert.equal(filterTrailTracks(tracks, '').length, 2);
  assert.equal(filterTrailTracks(tracks, 'inexistente').length, 0);
  assert.equal(filterTrailTracks(tracks, 'lingua')[0]?.name, 'Língua Portuguesa');
});

test('conclusão e desempenho permanecem métricas separadas', () => {
  const levels = createTrailLevels(questions);
  const first = levels[0];
  const second = levels[1];
  const answers = {
    [questions[0].id]: answer(questions[0].id, true),
    [questions[1].id]: answer(questions[1].id, false),
  };

  assert.deepEqual(trailLevelMetrics(first, answers), {
    answered: 1,
    correct: 1,
    total: 1,
    accuracy: 100,
    completed: true,
  });
  assert.equal(trailLevelMetrics(second, answers).completed, true);
  assert.equal(trailMetrics(levels, answers).accuracy, 50);
  assert.equal(trailMetrics(levels, answers).progress, 100);
});
