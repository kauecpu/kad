import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { parseLocalDraft } from '../src/services/local-draft.ts';

const question = {
  id: 'q-example', discipline: 'Matemática', subject: 'Matemática', topic: 'Porcentagens',
  board: 'CESGRANRIO', year: 2021, role: 'Agente', institution: 'Banco do Brasil',
  concurso: 'bb0121', level: 'Médio', statement: 'Quanto é 2 + 2?',
  alternatives: [{ id: 'A', text: '3' }, { id: 'B', text: '4' }], correct: 'B',
  publicationStatus: 'draft',
};

function packageFor(rows: unknown[]) {
  const jsonl = `${rows.map(row => JSON.stringify(row)).join('\n')}\n`;
  return {
    jsonl,
    manifest: { publicationStatus: 'draft', questions: 10, files: [{ path: 'questoes.jsonl', sha256: createHash('sha256').update(jsonl).digest('hex') }] },
  };
}

test('aceita somente um pacote local íntegro de dez questões draft', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    schemaVersion: 2, kind: 'question', source: { url: 'https://example.org/prova.pdf' },
    data: { ...question, id: `q-${index}` },
  }));
  const { manifest, jsonl } = packageFor(rows);
  assert.equal((await parseLocalDraft(manifest, jsonl)).length, 10);
  await assert.rejects(parseLocalDraft(manifest, `${jsonl} `), /alterado/);
  rows[1] = { ...rows[1], data: { ...question, id: 'q-0' } };
  const duplicate = packageFor(rows);
  await assert.rejects(parseLocalDraft(duplicate.manifest, duplicate.jsonl), /duplicado/);
  rows[1] = { ...rows[1], data: { ...question, id: 'q-1', publicationStatus: 'published' } };
  const published = packageFor(rows);
  await assert.rejects(parseLocalDraft(published.manifest, published.jsonl), /draft inválido/);
});
