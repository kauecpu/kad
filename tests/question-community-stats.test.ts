import assert from 'node:assert/strict';
import test from 'node:test';

import { accuracyFromCounts, communityAccuracySummary } from '../lib/accuracy.ts';

test('a taxa comunitária usa o total real de respostas', () => {
  assert.equal(accuracyFromCounts(7, 10), 70);
  assert.equal(accuracyFromCounts(1, 3), 33);
});

test('a taxa comunitária permanece entre zero e cem', () => {
  assert.equal(accuracyFromCounts(0, 0), 0);
  assert.equal(accuracyFromCounts(12, 10), 100);
  assert.equal(accuracyFromCounts(-1, 10), 0);
});

test('ausência de amostra não é apresentada como zero por cento', () => {
  assert.deepEqual(communityAccuracySummary(0, 0), {
    hasSample: false,
    valueLabel: 'Ainda sem dados',
    detailLabel: 'A taxa aparecerá quando houver respostas suficientes.',
  });
});

test('amostra comunitária informa percentual e quantidade de respostas', () => {
  assert.deepEqual(communityAccuracySummary(67.4, 3), {
    hasSample: true,
    valueLabel: '67%',
    detailLabel: 'Baseado em 3 respostas',
  });
  assert.equal(communityAccuracySummary(100, 1).detailLabel, 'Baseado em 1 resposta');
});
