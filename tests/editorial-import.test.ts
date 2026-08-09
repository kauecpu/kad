import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import { parseEditorialImport } from '../admin/src/lib/editorial-import.ts';

const importsPage = readFileSync(
  new NodeURL('../admin/src/pages/imports-page.tsx', import.meta.url),
  'utf8',
);
const importsApi = readFileSync(
  new NodeURL('../admin/src/lib/imports-api.ts', import.meta.url),
  'utf8',
);

const validQuestion = {
  schemaVersion: 1,
  kind: 'question',
  source: {
    provider: 'banca-exemplo',
    externalId: 'questao-1',
    url: 'https://example.com/q/1',
    collectedAt: '2026-08-09T12:00:00Z',
  },
  data: { id: 'q-exemplo-1' },
};

test('parser aceita JSONL e lista JSON no contrato editorial', () => {
  const jsonl = parseEditorialImport(`${JSON.stringify(validQuestion)}\n${JSON.stringify({ ...validQuestion, data: { id: 'q-exemplo-2' } })}`);
  assert.equal(jsonl.records.length, 2);
  assert.deepEqual(jsonl.issues, []);

  const list = parseEditorialImport(JSON.stringify([validQuestion]));
  assert.equal(list.records.length, 1);
  assert.deepEqual(list.issues, []);
});

test('parser recusa origem insegura e versão desconhecida', () => {
  const result = parseEditorialImport(JSON.stringify({
    ...validQuestion,
    schemaVersion: 2,
    source: { ...validQuestion.source, url: 'http://example.com/q/1' },
  }));
  assert.equal(result.records.length, 0);
  assert.match(result.issues.map((issue) => issue.message).join(' '), /schemaVersion/);
  assert.match(result.issues.map((issue) => issue.message).join(' '), /HTTPS/);
});

test('parser informa a linha inválida sem aceitar lote parcial', () => {
  const result = parseEditorialImport(`${JSON.stringify(validQuestion)}\n{invalido}`);
  assert.equal(result.records.length, 0);
  assert.deepEqual(result.issues, [{ line: 2, message: 'Linha JSON inválida.' }]);
});

test('painel permite revisar, corrigir e revalidar registros no staging', () => {
  assert.match(importsPage, /Registro JSON — revise ou corrija antes de importar/);
  assert.match(importsPage, /Salvar e revalidar/);
  assert.match(importsApi, /admin_update_import_item/);
});
