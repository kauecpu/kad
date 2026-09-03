import assert from 'node:assert/strict';
import test from 'node:test';

import { paymentFailureDetails } from '../supabase/functions/_shared/payment-observability.ts';

test('logs financeiros preservam somente campos técnicos sanitizados', () => {
  const details = paymentFailureDetails({
    operation: 'checkout_reconcile',
    category: 'provider_unavailable',
    startedAt: Date.now() - 20,
    checkoutId: '00000000-0000-4000-8000-000000000001',
    eventType: 'payment.updated',
    providerStatus: 503,
    providerCode: 'service_unavailable',
  });
  assert.equal(details.operation, 'checkout_reconcile');
  assert.equal(details.category, 'provider_unavailable');
  assert.equal(details.checkoutId, '00000000-0000-4000-8000-000000000001');
  assert.equal(details.providerStatus, 503);
  assert.ok(details.durationMs >= 0);
  assert.doesNotMatch(JSON.stringify(details), /token|email|payload/i);
});

test('logs financeiros removem identificadores e rótulos fora do contrato', () => {
  const details = paymentFailureDetails({
    operation: 'webhook_process',
    category: 'erro\nsegredo',
    startedAt: Date.now(),
    checkoutId: 'não-é-uuid',
    eventType: 'payment\nAuthorization: segredo',
    providerStatus: 999,
    providerCode: 'raw response with spaces',
  });
  assert.deepEqual(details, {
    operation: 'webhook_process',
    category: 'internal_error',
    durationMs: details.durationMs,
    eventType: 'invalid_event_type',
    providerCode: 'invalid_provider_code',
  });
});

test('diagnóstico do webhook diferencia rejeições sem incluir assinatura ou payload', () => {
  for (const category of ['invalid_webhook', 'invalid_signature', 'unexpected_environment']) {
    const details = paymentFailureDetails({
      operation: 'webhook_process',
      category,
      startedAt: Date.now(),
      eventType: 'payment',
    });
    assert.equal(details.category, category);
    assert.equal(details.eventType, 'payment');
    assert.equal('signature' in details, false);
    assert.equal('payload' in details, false);
  }
});
