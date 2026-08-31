import assert from 'node:assert/strict';
import test from 'node:test';

import { webhookProcessingOutcome } from '../supabase/functions/_shared/mercado-pago-webhook.ts';

test('evento não correlacionado permanece pendente para retry', () => {
  assert.deepEqual(webhookProcessingOutcome(false), {
    processed: false,
    errorCode: 'not_correlated',
  });
});

test('evento correlacionado pode ser finalizado como processado', () => {
  assert.deepEqual(webhookProcessingOutcome(true), {
    processed: true,
    errorCode: null,
  });
});
