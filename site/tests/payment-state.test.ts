import assert from 'node:assert/strict';
import test from 'node:test';

import { checkoutFeedbackFor } from '../src/core/payment.ts';
import {
  subscriptionFromRemoteRecord,
  subscriptionHasAccess,
  subscriptionPlanName,
} from '../src/core/subscription.ts';

const now = new Date('2026-09-02T12:00:00.000Z');

test('site preserva plano Platina remoto em vez de mostrá-lo como Básico', () => {
  const subscription = subscriptionFromRemoteRecord({
    plan: 'platinum',
    billing_cycle: 'monthly',
    provider: 'mercado_pago',
    status: 'active',
    started_at: '2026-09-01T12:00:00.000Z',
    current_period_end: '2026-10-01T12:00:00.000Z',
    cancel_at_period_end: false,
  }, now);
  assert.equal(subscription.plan, 'platinum');
  assert.equal(subscriptionPlanName(subscription.plan), 'KAD Platina');
  assert.equal(subscriptionHasAccess(subscription, now), true);
  assert.equal(subscription.autoRenew, true);
});

test('assinatura vencida perde acesso local mesmo antes da próxima sincronização', () => {
  const subscription = subscriptionFromRemoteRecord({
    plan: 'diamond',
    billing_cycle: 'annual',
    provider: 'mercado_pago',
    status: 'active',
    current_period_end: '2026-09-01T12:00:00.000Z',
    cancel_at_period_end: false,
  }, now);
  assert.equal(subscription.status, 'expired');
  assert.equal(subscriptionHasAccess(subscription, now), false);
  assert.equal(subscription.autoRenew, false);
});

test('linha remota malformada falha de modo fechado para o plano Básico', () => {
  assert.deepEqual(subscriptionFromRemoteRecord({
    plan: 'admin',
    billing_cycle: 'monthly',
    provider: 'mercado_pago',
    status: 'active',
    current_period_end: '2099-01-01T00:00:00.000Z',
  }, now), { plan: 'basic', status: 'inactive', autoRenew: false });
});

test('mensagens distinguem pendência, indisponibilidade, configuração e rejeição', () => {
  const basic = { plan: 'basic' as const, status: 'inactive' as const, autoRenew: false };
  assert.equal(checkoutFeedbackFor({ status: 'pending', reason: null }, basic)?.title, 'Aguardando pagamento');
  assert.equal(checkoutFeedbackFor({ status: 'unavailable', reason: 'provider_unavailable' }, basic)?.canRetry, true);
  assert.equal(checkoutFeedbackFor({ status: 'failed', reason: 'configuration_missing' }, basic)?.title, 'Pagamento indisponível neste ambiente');
  for (const reason of ['configuration_missing', 'provider_credentials_rejected']) {
    const feedback = checkoutFeedbackFor({ status: 'unavailable', reason }, basic);
    assert.equal(feedback?.title, 'Pagamento indisponível neste ambiente');
    assert.equal(feedback?.canRetry, false);
  }
  assert.equal(checkoutFeedbackFor({ status: 'failed', reason: 'payment_rejected' }, basic)?.title, 'Pagamento não aprovado');
});

test('aprovação só aparece concluída depois que o acesso foi liberado', () => {
  const basic = { plan: 'basic' as const, status: 'inactive' as const, autoRenew: false };
  const active = {
    plan: 'diamond' as const,
    status: 'active' as const,
    autoRenew: true,
    renewsAt: new Date(Date.now() + 86_400_000).toISOString(),
  };
  assert.equal(checkoutFeedbackFor({ status: 'approved', reason: null }, basic)?.canRetry, true);
  assert.equal(checkoutFeedbackFor({ status: 'approved', reason: null }, active)?.canRetry, false);
});
