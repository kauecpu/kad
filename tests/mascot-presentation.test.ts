import assert from 'node:assert/strict';
import test from 'node:test';

import { getMascotAccessibilityLabel } from '../constants/mascots.ts';

test('o mascote de boas-vindas descreve a pose de escrita para leitores de tela', () => {
  assert.equal(getMascotAccessibilityLabel('welcome'), 'Mascote KAD escrevendo com um lápis');
});
