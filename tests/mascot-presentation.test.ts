import assert from 'node:assert/strict';
import test from 'node:test';

import { getMascotAccessibilityLabel } from '../constants/mascots.ts';

test('cada slide descreve sua pose de estudo para leitores de tela', () => {
  const expectations = [
    ['welcome', 'Mascote KAD escrevendo com um lápis'],
    ['practice', 'Mascote KAD em pé segurando um lápis'],
    ['simulation', 'Mascote KAD resolvendo uma prova com cronômetro'],
    ['goal', 'Mascote KAD segurando uma bandeira de objetivo e um livro'],
  ] as const;

  for (const [variant, label] of expectations) {
    assert.equal(getMascotAccessibilityLabel(variant), label);
  }
});
