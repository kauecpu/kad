import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import { parseEditorialImport } from '../admin/src/lib/editorial-import.ts';
import type { EditorialImportRecord } from '../admin/src/types.ts';

const importsPage = readFileSync(
  new NodeURL('../admin/src/pages/imports-page.tsx', import.meta.url),
  'utf8',
);
const importsApi = readFileSync(
  new NodeURL('../admin/src/lib/imports-api.ts', import.meta.url),
  'utf8',
);
const fixtureText = readFileSync(
  new NodeURL('../contracts/editorial-question-v1.fixture.jsonl', import.meta.url),
  'utf8',
).trim();
const validQuestion = JSON.parse(fixtureText) as EditorialImportRecord;

function secondQuestion(): EditorialImportRecord {
  return {
    ...structuredClone(validQuestion),
    source: {
      ...validQuestion.source,
      externalId: 'banca-exemplo:prova-2026:question:2',
      fingerprint: 'c'.repeat(64),
    },
    data: { ...validQuestion.data, id: 'q-banca-exemplo-aaaaaaaaaaaa-2' },
  };
}

test('parser aceita a fixture compartilhada em JSONL e uma lista JSON', () => {
  const jsonl = parseEditorialImport(`${fixtureText}\n${JSON.stringify(secondQuestion())}`);
  assert.equal(jsonl.records.length, 2);
  assert.deepEqual(jsonl.issues, []);

  const list = parseEditorialImport(JSON.stringify([validQuestion]));
  assert.equal(list.records.length, 1);
  assert.deepEqual(list.issues, []);
});

test('parser recusa origem insegura, fingerprint ausente e versão desconhecida', () => {
  const result = parseEditorialImport(JSON.stringify({
    ...validQuestion,
    schemaVersion: 2,
    source: { ...validQuestion.source, url: 'http://example.com/q/1', fingerprint: undefined },
  }));
  const messages = result.issues.map((issue) => issue.message).join(' ');
  assert.equal(result.records.length, 0);
  assert.match(messages, /schemaVersion/);
  assert.match(messages, /HTTPS/);
  assert.match(messages, /fingerprint/);
});

test('parser recusa campos ausentes, questão anulada e publicação automática', () => {
  const payload = structuredClone(validQuestion);
  const data = payload.data as Record<string, unknown>;
  delete data.explanation;
  delete data.correct;
  data.answerStatus = 'annulled';
  data.publicationStatus = 'published';
  const result = parseEditorialImport(JSON.stringify(payload));
  const messages = result.issues.map((issue) => issue.message).join(' ');

  assert.match(messages, /explanation/);
  assert.match(messages, /correct/);
  assert.match(messages, /publicationStatus/);
});

test('parser recusa alternativas fora da sequência A até E', () => {
  const payload = structuredClone(validQuestion);
  const data = payload.data as Record<string, unknown>;
  data.alternatives = [
    ...((data.alternatives as unknown[]) ?? []),
    { id: 'F', text: 'Alternativa fora do contrato.' },
  ];
  const result = parseEditorialImport(JSON.stringify(payload));
  assert.equal(result.records.length, 0);
  assert.match(result.issues.map((issue) => issue.message).join(' '), /sequencial/);
});

test('parser recusa IDs, origens e fingerprints duplicados no mesmo arquivo', () => {
  const duplicate = structuredClone(validQuestion);
  const result = parseEditorialImport(`${fixtureText}\n${JSON.stringify(duplicate)}`);
  const messages = result.issues.map((issue) => issue.message).join(' ');

  assert.match(messages, /id duplicado/);
  assert.match(messages, /provider\/externalId duplicada/);
  assert.match(messages, /fingerprint duplicado/);
});

test('parser informa a linha inválida sem aceitar lote parcial', () => {
  const result = parseEditorialImport(`${fixtureText}\n{invalido}`);
  assert.equal(result.records.length, 0);
  assert.deepEqual(result.issues, [{ line: 2, message: 'Linha JSON inválida.' }]);
});

test('painel visualiza e permite revisar registros antes da importação como rascunho', () => {
  assert.match(importsPage, /Registro JSON — revise ou corrija antes de importar/);
  assert.match(importsPage, /Salvar e revalidar/);
  assert.match(importsPage, /Importar os itens selecionados como rascunhos/);
  assert.match(importsPage, /importRecordLabel\(record\)/);
  assert.match(importsApi, /admin_update_import_item/);
});
