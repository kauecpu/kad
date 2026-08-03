import assert from 'node:assert/strict';
import test from 'node:test';

import { accuracyFromCounts } from '../lib/accuracy.ts';

test('a taxa comunitária usa o total real de respostas', () => {
  assert.equal(accuracyFromCounts(7, 10), 70);
  assert.equal(accuracyFromCounts(1, 3), 33);
});

test('a taxa comunitária permanece entre zero e cem', () => {
  assert.equal(accuracyFromCounts(0, 0), 0);
  assert.equal(accuracyFromCounts(12, 10), 100);
  assert.equal(accuracyFromCounts(-1, 10), 0);
});
