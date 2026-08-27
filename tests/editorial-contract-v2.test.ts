import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import { EDITORIAL_IMPORT_V2_FINGERPRINT } from '../admin/src/lib/editorial-contract.ts';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

test('fingerprint publicado corresponde à fonte canônica do contrato v2', () => {
  const schema = JSON.parse(readFileSync(
    new NodeURL('../contracts/editorial-question-import-v2.schema.json', import.meta.url),
    'utf8',
  )) as unknown;
  const fingerprint = createHash('sha256').update(canonical(schema)).digest('hex');
  const declared = readFileSync(
    new NodeURL('../contracts/editorial-question-import-v2.sha256', import.meta.url),
    'utf8',
  ).trim();
  assert.equal(fingerprint, EDITORIAL_IMPORT_V2_FINGERPRINT);
  assert.equal(declared, EDITORIAL_IMPORT_V2_FINGERPRINT);
});
