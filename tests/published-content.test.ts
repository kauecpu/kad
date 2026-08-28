import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInitialCatalogImportRecords,
  buildInitialCatalogSeed,
} from '../lib/editorial-seed.ts';
import {
  mapPublishedConcurso,
  mapPublishedQuestion,
  mapPublishedQuestions,
} from '../lib/published-content.ts';

const validQuestion = {
  id: 'q-publicada',
  discipline: 'Direito',
  subject: 'Direito Constitucional',
  topic: 'Direitos fundamentais',
  board: 'KAD',
  year: 2026,
  role: 'Analista',
  institution: 'KAD',
  concurso: 'Catálogo KAD',
  level: 'Superior',
  difficulty: 'Média',
  statement: 'Qual alternativa representa corretamente o contrato publicado?',
  alternatives: [
    { id: 'A', text: 'Uma alternativa incorreta.' },
    { id: 'B', text: 'A alternativa correta.' },
  ],
  correct: 'B',
  explanation: 'A alternativa B atende ao contrato editorial esperado.',
};

test('questões publicadas são validadas antes de entrar no aplicativo', () => {
  assert.deepEqual(mapPublishedQuestion(validQuestion), validQuestion);
  assert.equal(mapPublishedQuestion({ ...validQuestion, correct: 'E' }), null);
  assert.equal(mapPublishedQuestion({ ...validQuestion, alternatives: [] }), null);
  assert.deepEqual(mapPublishedQuestions([validQuestion, { id: 'incompleta' }]), [validQuestion]);
  assert.deepEqual(
    mapPublishedQuestion({ ...validQuestion, explanation: null }),
    { ...validQuestion, explanation: undefined },
  );
});

test('concursos publicados exigem fonte oficial HTTPS e dados completos', () => {
  const row = {
    id: 'c-publicado',
    short_name: 'KAD',
    icon: 'business-outline',
    icon_color: '#6D28D9',
    organ: 'KAD Concursos',
    title: 'Concurso de demonstração',
    board: 'KAD',
    state: 'Nacional',
    city: null,
    region: 'Nacional',
    levels: ['Superior'],
    vacancies: 10,
    salary_min: '5000.00',
    salary_max: '6000.00',
    registration_start: null,
    registration_end: null,
    exam_date: null,
    fee: null,
    status: 'previsto',
    highlights: [],
    edital_url: 'https://example.com/edital',
    updated_at: '2026-08-16T00:00:00.000Z',
    concurso_roles: [
      { name: 'Analista', vacancies: 10, salary: '6000.00', level: 'Superior', sort_order: 0 },
    ],
  };
  assert.equal(mapPublishedConcurso(row)?.contentSource, 'published');
  assert.equal(
    mapPublishedConcurso({ ...row, source_provider: 'kad-demo-catalog' })?.contentSource,
    'demo',
  );
  assert.equal(mapPublishedConcurso({ ...row, edital_url: 'http://example.com' }), null);
});

test('o lote inicial publica somente o acervo esperado e não contém segredos', () => {
  const seed = buildInitialCatalogSeed('2026-08-16T00:00:00.000Z');
  assert.equal(seed.concursos.length, 15);
  assert.equal(seed.questions.length, 51);
  assert.ok([...seed.concursos, ...seed.questions].every((item) => item.publicationStatus === 'published'));
  assert.ok(seed.questions.every((item) => String(item.sourceUrl).startsWith('https://')));
  const records = buildInitialCatalogImportRecords('2026-08-16T00:00:00.000Z');
  assert.equal(records.length, 66);
  assert.ok(records.every((record) => record.source.url.startsWith('https://')));
  assert.equal(records[0]?.source.provider, 'kad-demo-catalog');
  assert.equal(records.at(-1)?.source.provider, 'kad-authored-catalog');
  const keys = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      visit(nested);
    }
  };
  visit(seed);
  visit(records);
  assert.doesNotMatch(Array.from(keys).join(' '), /service_role|secret|password|token/i);
});

test('aceita questão publicada sem dificuldade', () => {
  const question = mapPublishedQuestion({ ...validQuestion, difficulty: undefined });

  assert.ok(question);
  assert.equal(question.difficulty, undefined);
});
