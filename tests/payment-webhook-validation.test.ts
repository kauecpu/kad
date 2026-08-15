import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkoutMatchesProviderSubscription,
  parseMercadoPagoWebhookBody,
  webhookEnvironmentMatches,
} from '../supabase/functions/_shared/mercado-pago-webhook.ts';

test('aceita somente o formato minimo e tipado do webhook do Mercado Pago', () => {
  assert.deepEqual(
    parseMercadoPagoWebhookBody({
      id: 'evento-1',
      type: 'payment',
      action: 'payment.updated',
      live_mode: false,
      data: { id: '123' },
    }),
    {
      id: 'evento-1',
      type: 'payment',
      action: 'payment.updated',
      live_mode: false,
      data: { id: '123' },
    }
  );

  assert.equal(parseMercadoPagoWebhookBody({ type: 'payment', data: { id: '123' } }), null);
  assert.equal(
    parseMercadoPagoWebhookBody({ type: 'payment', live_mode: 'false', data: { id: '123' } }),
    null
  );
  assert.equal(
    parseMercadoPagoWebhookBody({ type: { malicious: true }, live_mode: false, data: { id: '123' } }),
    null
  );
  assert.equal(
    parseMercadoPagoWebhookBody({ type: 'payment', live_mode: false, data: { id: {} } }),
    null
  );
});

test('valida o ambiente do webhook de forma fechada', () => {
  assert.equal(webhookEnvironmentMatches('false', false), true);
  assert.equal(webhookEnvironmentMatches('true', true), true);
  assert.equal(webhookEnvironmentMatches('false', true), false);
  assert.equal(webhookEnvironmentMatches(undefined, false), false);
  assert.equal(webhookEnvironmentMatches('teste', false), false);
});

test('nao correlaciona um checkout ja vinculado a outra assinatura', () => {
  assert.equal(checkoutMatchesProviderSubscription(null, 'preapproval-1'), true);
  assert.equal(checkoutMatchesProviderSubscription('preapproval-1', 'preapproval-1'), true);
  assert.equal(checkoutMatchesProviderSubscription('preapproval-2', 'preapproval-1'), false);
});

