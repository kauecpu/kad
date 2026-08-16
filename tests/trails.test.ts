import assert from 'node:assert/strict';
import test from 'node:test';

import { DISCIPLINES } from '../data/disciplines.ts';
import { CONCURSO_PACKS } from '../data/exam-concursos.ts';
import { QUESTIONS } from '../data/questions.ts';
import { questionsForPack } from '../lib/simulations.ts';
import { createTrailLevels, questionsForDisciplines } from '../lib/trails.ts';

test('cada disciplina existente gera uma trilha de dez níveis com questões do banco atual', () => {
  for (const discipline of DISCIPLINES) {
    const candidates = questionsForDisciplines(QUESTIONS, [discipline.name]);
    const candidateIds = new Set(candidates.map((question) => question.id));
    const levels = createTrailLevels(candidates);

    assert.equal(levels.length, 10, discipline.name);
    assert.deepEqual(levels.map((level) => level.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(
      levels.every((level) => level.questions.every((question) => candidateIds.has(question.id))),
      discipline.name
    );
    const distributedIds = levels.flatMap((level) => level.questions.map((question) => question.id));
    assert.equal(new Set(distributedIds).size, distributedIds.length, discipline.name);
    assert.deepEqual(new Set(distributedIds), candidateIds, discipline.name);
  }
});

test('cada concurso ou área usa somente questões do seu escopo real', () => {
  for (const pack of CONCURSO_PACKS) {
    const candidates = questionsForPack(pack);
    const candidateIds = new Set(candidates.map((question) => question.id));
    const levels = createTrailLevels(candidates);

    assert.equal(levels.length, 10, pack.name);
    assert.ok(
      levels.every((level) =>
        level.questions.every((question) => candidateIds.has(question.id))
      ),
      pack.name
    );
    const distributedIds = levels.flatMap((level) => level.questions.map((question) => question.id));
    assert.equal(new Set(distributedIds).size, distributedIds.length, pack.name);
    assert.deepEqual(new Set(distributedIds), candidateIds, pack.name);
  }
});

test('níveis sem conteúdo permanecem em preparação sem repetir questões', () => {
  const oneQuestion = QUESTIONS.slice(0, 1);
  const levels = createTrailLevels(oneQuestion);
  assert.equal(levels.filter((level) => level.questions.length > 0).length, 1);
  assert.equal(levels.flatMap((level) => level.questions).length, 1);
});

test('acervos pequenos ocupam níveis consecutivos sem fingir progressão avançada', () => {
  const levels = createTrailLevels(QUESTIONS.slice(0, 4));
  assert.deepEqual(
    levels.filter((level) => level.questions.length > 0).map((level) => level.number),
    [1, 2, 3, 4]
  );
});
