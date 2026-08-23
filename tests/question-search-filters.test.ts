import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import { QUESTIONS } from '../data/questions.ts';
import {
  countSearchFilters,
  EMPTY_SEARCH,
  searchOptionsForQuestions,
  searchQuestions,
  subjectsForDisciplines,
  topicsForSelection,
} from '../lib/search.ts';

const searchScreen = readFileSync(
  new NodeURL('../app/questoes/buscar.tsx', import.meta.url),
  'utf8'
);

test('a busca expõe todos os filtros sustentados pelo banco de questões', () => {
  for (const key of [
    'disciplines',
    'subjects',
    'topics',
    'boards',
    'institutions',
    'concursos',
    'roles',
    'years',
    'levels',
    'difficulties',
  ]) {
    assert.match(searchScreen, new RegExp(`renderFilterRow\\('${key}'`));
  }

  assert.match(searchScreen, /title="Conteúdo"/);
  assert.match(searchScreen, /title="Prova"/);
  assert.match(searchScreen, /title="Seu histórico"/);
  assert.match(searchScreen, /ANSWERED_OPTIONS/);
  assert.match(searchScreen, /RESULT_OPTIONS/);
  assert.doesNotMatch(searchScreen, /MODE_OPTIONS|Básicos|Avançados/);
});

test('as opções novas são derivadas de metadados reais', () => {
  const options = searchOptionsForQuestions(QUESTIONS);

  assert.deepEqual(
    options.subjects,
    [...new Set(QUESTIONS.map((question) => question.subject))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    )
  );
  assert.deepEqual(
    options.concursos,
    [...new Set(QUESTIONS.map((question) => question.concurso))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    )
  );
  assert.ok(options.levels.length > 0);
  assert.ok(options.levels.every((level) => QUESTIONS.some((question) => question.level === level)));
});

test('matéria e assunto acompanham a disciplina selecionada', () => {
  const sample = QUESTIONS[0];
  const subjects = subjectsForDisciplines([sample.discipline], QUESTIONS);
  const topics = topicsForSelection([sample.discipline], [sample.subject], QUESTIONS);

  assert.ok(subjects.includes(sample.subject));
  assert.ok(topics.includes(sample.topic));
  assert.ok(
    subjects.every((subject) =>
      QUESTIONS.some(
        (question) => question.discipline === sample.discipline && question.subject === subject
      )
    )
  );
  assert.ok(
    topics.every((topic) =>
      QUESTIONS.some(
        (question) =>
          question.discipline === sample.discipline &&
          question.subject === sample.subject &&
          question.topic === topic
      )
    )
  );
});

test('matéria, concurso e escolaridade restringem resultados em conjunto', () => {
  const sample = QUESTIONS[0];
  const search = {
    ...EMPTY_SEARCH,
    subjects: [sample.subject],
    concursos: [sample.concurso],
    levels: [sample.level],
  };
  const results = searchQuestions(search, {}, QUESTIONS);

  assert.ok(results.some((question) => question.id === sample.id));
  assert.ok(
    results.every(
      (question) =>
        question.subject === sample.subject &&
        question.concurso === sample.concurso &&
        question.level === sample.level
    )
  );
  assert.equal(countSearchFilters(search), 3);
});
