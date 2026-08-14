import assert from 'node:assert/strict';
import test from 'node:test';

import { formatSalaryRangeShort } from '../lib/format.ts';

test('compacta uma faixa salarial em milhares sem repetir a moeda', () => {
  assert.equal(formatSalaryRangeShort(2100, 3500), 'R$ 2,1–3,5 mil');
  assert.equal(formatSalaryRangeShort(3600, 5700), 'R$ 3,6–5,7 mil');
});

test('preserva o formato de valor único usado pelos cards', () => {
  assert.equal(formatSalaryRangeShort(5000, 5000), 'Até R$ 5 mil');
});

test('mantém faixas menores que mil legíveis', () => {
  assert.equal(formatSalaryRangeShort(500, 900), 'R$ 500,00–R$ 900,00');
});
