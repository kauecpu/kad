import assert from 'node:assert/strict';
import test from 'node:test';

import { getMascotAccessibilityLabel } from '../constants/mascots.ts';

test('todos os slides descrevem o novo mascote escrevendo para leitores de tela', () => {
  for (const variant of ['welcome', 'nerd', 'book', 'goal'] as const) {
    assert.equal(getMascotAccessibilityLabel(variant), 'Mascote KAD escrevendo com um lápis');
  }
});
