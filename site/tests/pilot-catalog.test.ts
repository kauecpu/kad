import assert from 'node:assert/strict';
import test from 'node:test';

import { getCatalog, replacePublishedCatalog, resetCatalog } from '../src/data/catalog.ts';
import type { Question } from '../src/types/domain.ts';

test('catálogo local cria filtros somente para disciplinas e assuntos presentes', () => {
  const question = {
    id: 'q-pilot', discipline: 'Tecnologia da Informação', topic: 'Linguagens e Bibliotecas',
    subject: 'Programação', board: 'CESGRANRIO', year: 2021, role: 'Agente',
    institution: 'Banco do Brasil', concurso: 'bb0121', level: 'Médio', statement: 'Questão',
    alternatives: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }], correct: 'A',
  } as Question;
  try {
    replacePublishedCatalog({ questions: [question], concursos: [] });
    assert.deepEqual(getCatalog().disciplines.map(item => item.name), ['Tecnologia da Informação']);
    assert.deepEqual(getCatalog().disciplines[0].topics, ['Linguagens e Bibliotecas']);
  } finally {
    resetCatalog();
  }
});
