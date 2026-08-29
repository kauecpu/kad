import assert from 'node:assert/strict';
import test from 'node:test';

import { buildQuestionPacks } from '../lib/question-catalog.ts';
import { questionsForPack, simulationCandidates } from '../lib/simulations.ts';
import { searchOptionsForQuestions } from '../lib/search.ts';
import type { Question } from '../types/index.ts';

function question(overrides: Partial<Question>): Question {
  return {
    id: 'q-1',
    discipline: 'Direito Tributário',
    subject: 'Tributos',
    topic: 'Impostos',
    board: 'FGV',
    year: 2023,
    role: 'Auditor Fiscal da Receita Federal do Brasil',
    institution: 'FGV Conhecimento',
    concurso: 'rfb22',
    level: 'Superior',
    statement: 'Enunciado',
    alternatives: [
      { id: 'A', text: 'A' },
      { id: 'B', text: 'B' },
    ],
    correct: 'A',
    ...overrides,
  };
}

const publishedQuestions = [
  question({ id: 'auditor-2023' }),
  question({
    id: 'auditor-2024',
    year: 2024,
  }),
  question({
    id: 'analista-2023',
    role: 'Analista Tributário da Receita Federal do Brasil',
  }),
];

test('grupos publicados usam identidade estável e separam ano e cargo', () => {
  const first = buildQuestionPacks(publishedQuestions, 'published');
  const second = buildQuestionPacks([...publishedQuestions].reverse(), 'published');

  assert.deepEqual(first.map((pack) => pack.id), second.map((pack) => pack.id));
  assert.equal(first.length, 3);
  assert.ok(first.every((pack) => pack.questionIds?.length === 1));
  assert.ok(first.some((pack) => pack.name.includes('Auditor Fiscal')));
  assert.ok(first.some((pack) => pack.subtitle?.includes('2024')));
  assert.equal(
    first.reduce((total, pack) => total + questionsForPack(pack, publishedQuestions).length, 0),
    publishedQuestions.length,
  );
});

test('grupo dinâmico é a mesma fonte da contagem e do detalhe', () => {
  const pack = buildQuestionPacks(publishedQuestions, 'published')[0];

  assert.equal(pack.questionIds?.length, questionsForPack(pack, publishedQuestions).length);
  assert.deepEqual(
    pack.questionIds,
    questionsForPack(pack, publishedQuestions).map((item) => item.id),
  );
});

test('Banco do Brasil não recebe questões de outro concurso com a mesma disciplina', () => {
  const questions = [
    question({ id: 'bb', concurso: 'Banco do Brasil', institution: 'Banco do Brasil', role: 'Escriturário' }),
    question({ id: 'caixa', concurso: 'Caixa', institution: 'Caixa Econômica Federal', role: 'Técnico Bancário' }),
  ];
  const packs = buildQuestionPacks(questions, 'published');
  const bancoDoBrasil = packs.find((pack) => pack.name.includes('Banco do Brasil'));
  assert.ok(bancoDoBrasil);

  assert.deepEqual(questionsForPack(bancoDoBrasil, questions).map((item) => item.id), ['bb']);
});

test('reprocessamento mantém identidade e não duplica a mesma questão', () => {
  const repeated = [...publishedQuestions, publishedQuestions[0]];
  const first = buildQuestionPacks(repeated, 'published');
  const second = buildQuestionPacks(repeated, 'published');

  assert.deepEqual(first, second);
  assert.equal(first.flatMap((pack) => pack.questionIds ?? []).length, publishedQuestions.length);
});

test('catálogo demonstrativo continua sendo fallback sem conteúdo publicado', () => {
  const packs = buildQuestionPacks([], 'demo');

  assert.ok(packs.length > 0);
  assert.equal(packs[0].id, 'banco-do-brasil');
});

test('disciplinas publicadas fora da taxonomia fixa aparecem nos filtros', () => {
  const options = searchOptionsForQuestions(publishedQuestions);

  assert.ok(options.disciplines.includes('Direito Tributário'));
});

test('simulados aceitam um grupo dinâmico sem consultar o catálogo fixo', () => {
  const packs = buildQuestionPacks(publishedQuestions, 'published');
  const pack = packs.find((item) => item.name.includes('Auditor Fiscal'));
  assert.ok(pack);

  const candidates = simulationCandidates(
    {
      packId: pack.id,
      disciplines: [],
      topics: [],
      boards: [],
      years: [],
      difficulties: [],
      questionCount: 10,
      durationMinutes: 20,
      shuffleQuestions: false,
      shuffleAlternatives: false,
    },
    publishedQuestions,
    packs,
  );

  assert.deepEqual(candidates.map((item) => item.id), ['auditor-2023']);
});
