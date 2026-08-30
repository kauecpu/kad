import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyGooglePurchase,
  GOOGLE_PRODUCT_CATALOG,
} from '../supabase/functions/_shared/google-play.ts';

const future = '2026-09-30T00:00:00.000Z';
const now = new Date('2026-08-30T00:00:00.000Z');

test('o catálogo Google contém somente Platina e Diamante', () => {
  assert.deepEqual(Object.keys(GOOGLE_PRODUCT_CATALOG).sort(), [
    'kad_diamond_annual',
    'kad_diamond_monthly',
    'kad_diamond_quarterly',
    'kad_platinum_annual',
    'kad_platinum_monthly',
    'kad_platinum_quarterly',
  ]);
});

test('classifica compra ativa com ciclo e renovação', () => {
  assert.deepEqual(
    classifyGooglePurchase({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{
        productId: 'kad_platinum_monthly',
        expiryTime: future,
        latestSuccessfulOrderId: 'GPA.test',
        autoRenewingPlan: { autoRenewEnabled: true },
      }],
    }, 'kad_platinum_monthly', now),
    {
      ok: true,
      plan: 'platinum',
      billingCycle: 'monthly',
      status: 'active',
      entitled: true,
      expiresAt: future,
      autoRenew: true,
      orderId: 'GPA.test',
    },
  );
});

test('não libera compra pendente ou SKU diferente', () => {
  assert.deepEqual(
    classifyGooglePurchase({ subscriptionState: 'SUBSCRIPTION_STATE_PENDING', lineItems: [{ productId: 'kad_diamond_monthly' }] }, 'kad_diamond_monthly', now),
    { ok: false, code: 'purchase_pending' },
  );
  assert.deepEqual(
    classifyGooglePurchase({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: 'kad_diamond_monthly', expiryTime: future }] }, 'kad_diamond_annual', now),
    { ok: false, code: 'product_mismatch' },
  );
});

test('mantém acesso durante cancelamento ou cobrança pendente até expirar', () => {
  const canceled = classifyGooglePurchase({
    subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
    lineItems: [{ productId: 'kad_diamond_annual', expiryTime: future, autoRenewingPlan: { autoRenewEnabled: false } }],
  }, 'kad_diamond_annual', now);
  assert.equal(canceled.ok && canceled.status, 'canceled');
  assert.equal(canceled.ok && canceled.entitled, true);

  const onHold = classifyGooglePurchase({
    subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD',
    lineItems: [{ productId: 'kad_diamond_annual', expiryTime: future }],
  }, 'kad_diamond_annual', now);
  assert.equal(onHold.ok && onHold.status, 'past_due');
  assert.equal(onHold.ok && onHold.entitled, true);
});

test('não concede acesso a assinatura expirada ou sem expiry válido', () => {
  const expired = classifyGooglePurchase({
    subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED',
    lineItems: [{ productId: 'kad_platinum_annual', expiryTime: '2026-08-01T00:00:00.000Z' }],
  }, 'kad_platinum_annual', now);
  assert.equal(expired.ok && expired.status, 'expired');
  assert.equal(expired.ok && expired.entitled, false);

  const invalidDate = classifyGooglePurchase({
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    lineItems: [{ productId: 'kad_platinum_annual', expiryTime: 'invalid' }],
  }, 'kad_platinum_annual', now);
  assert.equal(invalidDate.ok && invalidDate.entitled, false);
});
