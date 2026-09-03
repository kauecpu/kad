import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkoutMatchesProviderSubscription,
  isSupportedMercadoPagoEventType,
  parseMercadoPagoWebhookBody,
  paymentStatusReason,
  webhookEnvironmentMatches,
  signedWebhookResourceId,
  webhookStructureFailure,
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

test('subscription envelope does not invent absent live_mode; resource verification remains mandatory', () => {
  for (const type of ['subscription_preapproval', 'subscription_authorized_payment']) {
    const body = { type, data: { id: 'resource-1' }, action: 'updated' };
    assert.equal(parseMercadoPagoWebhookBody(body)?.live_mode, undefined);
    assert.equal(parseMercadoPagoWebhookBody({ ...body, live_mode: 'true' }), null);
  }
  assert.equal(webhookEnvironmentMatches('true', undefined), false);
  assert.equal(webhookStructureFailure({ type: 'payment' }), 'missing_environment');
});

test('resource must be bound to the signed query, without duplicate or body conflicts', () => {
  const body = { type: 'payment', live_mode: true, data: { id: 'abc' } };
  assert.equal(signedWebhookResourceId(new URL('https://example.invalid?data.id=abc'), body), 'abc');
  for (const query of ['', '?data.id=other', '?data.id=abc&data_id=other', '?data.id=abc&data.id=other', '?data.id=../abc']) {
    assert.equal(signedWebhookResourceId(new URL(`https://example.invalid${query}`), body), null);
  }
});

test('traduz estados financeiros terminais sem expor payloads do provedor', () => {
  assert.equal(paymentStatusReason('approved'), null);
  assert.equal(paymentStatusReason('rejected'), 'payment_rejected');
  assert.equal(paymentStatusReason('refunded'), 'payment_refunded');
  assert.equal(paymentStatusReason('charged_back'), 'payment_chargeback');
});

test('valida o ambiente do webhook de forma fechada', () => {
  assert.equal(webhookEnvironmentMatches('false', false), true);
  assert.equal(webhookEnvironmentMatches('true', true), true);
  assert.equal(webhookEnvironmentMatches('false', true), false);
  assert.equal(webhookEnvironmentMatches(undefined, false), false);
  assert.equal(webhookEnvironmentMatches('teste', false), false);
});

test('processa somente eventos financeiros previstos no contrato', () => {
  assert.equal(isSupportedMercadoPagoEventType('subscription_preapproval'), true);
  assert.equal(isSupportedMercadoPagoEventType('subscription_authorized_payment'), true);
  assert.equal(isSupportedMercadoPagoEventType('payment'), true);
  assert.equal(isSupportedMercadoPagoEventType('topic_chargebacks_wh'), true);
  assert.equal(isSupportedMercadoPagoEventType('merchant_order'), false);
});

test('nao correlaciona um checkout ja vinculado a outra assinatura', () => {
  assert.equal(checkoutMatchesProviderSubscription(null, 'preapproval-1'), true);
  assert.equal(checkoutMatchesProviderSubscription('preapproval-1', 'preapproval-1'), true);
  assert.equal(checkoutMatchesProviderSubscription('preapproval-2', 'preapproval-1'), false);
});
