import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseEditorialImport } from '../admin/src/lib/editorial-import.ts';
import { importQuestionsLocally } from '../admin/src/lib/editorial-question-record.ts';

const packagePath = process.argv[2];
if (!packagePath) throw new Error('Informe o caminho de questoes.jsonl.');

const parsed = parseEditorialImport(readFileSync(packagePath, 'utf8'));
if (parsed.issues.length) {
  throw new Error(`Pacote inválido: ${JSON.stringify(parsed.issues.slice(0, 20))}`);
}

const first = importQuestionsLocally(parsed.records);
const beforeReimport = JSON.stringify(Array.from(first.catalog.entries()));
const second = importQuestionsLocally(parsed.records, first.catalog);
const afterReimport = JSON.stringify(Array.from(second.catalog.entries()));

assert.equal(second.created, 0);
assert.equal(second.catalog.size, first.catalog.size);
assert.equal(afterReimport, beforeReimport);

console.log(JSON.stringify({
  records: parsed.records.length,
  firstImport: { created: first.created, catalogSize: first.catalog.size },
  secondImport: { created: second.created, catalogSize: second.catalog.size },
  unchangedOnReimport: true,
}));
