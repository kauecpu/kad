import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorizedPaymentsSearchPath,
  reconcileAuthorizedPayments,
  reconcileProviderSubscription,
} from '../supabase/functions/_shared/mercado-pago-reconciliation.ts';

const target = {
  checkoutId: '00000000-0000-4000-8000-000000000001',
  providerSubscriptionId: 'preapproval/a b',
  amountCents: 1499,
  currency: 'BRL',
};
const reference = `kad_checkout:${target.checkoutId}`;

test('consulta faturas pela assinatura sem concatenar parâmetros inseguros', () => {
  const url = new URL(`https://api.mercadopago.com${authorizedPaymentsSearchPath(target.providerSubscriptionId)}`);
  assert.equal(url.pathname, '/authorized_payments/search');
  assert.equal(url.searchParams.get('preapproval_id'), target.providerSubscriptionId);
  assert.equal([...url.searchParams.keys()].length, 1);
});

test('aceita assinatura correlacionada por id, referência, valor e moeda', () => {
  assert.deepEqual(reconcileProviderSubscription({
    id: target.providerSubscriptionId,
    external_reference: reference,
    status: 'authorized',
    auto_recurring: { transaction_amount: 14.99, currency_id: 'BRL' },
  }, target), { status: 'authorized', observedAt: null });

  assert.equal(reconcileProviderSubscription({
    id: target.providerSubscriptionId,
    external_reference: 'kad_checkout:00000000-0000-4000-8000-000000000002',
    status: 'authorized',
    auto_recurring: { transaction_amount: 14.99, currency_id: 'BRL' },
  }, target), null);
});

test('converte apenas pagamentos estritamente correlacionados', () => {
  const result = reconcileAuthorizedPayments({ results: [{
    preapproval_id: target.providerSubscriptionId,
    external_reference: reference,
    transaction_amount: 14.99,
    currency_id: 'BRL',
    debit_date: '2026-09-02T12:00:00.000Z',
    last_modified: '2026-09-02T12:01:00.000Z',
    payment: { id: 12345, status: 'approved' },
  }] }, target);

  assert.deepEqual(result, [{
    providerPaymentId: '12345',
    providerStatus: 'approved',
    amountCents: 1499,
    currency: 'BRL',
    paidAt: '2026-09-02T12:00:00.000Z',
    providerObservedAt: '2026-09-02T12:01:00.000Z',
  }]);
});

test('não concede crédito para agendamento sem pagamento e rejeita divergências', () => {
  assert.deepEqual(reconcileAuthorizedPayments({ results: [{
    preapproval_id: target.providerSubscriptionId,
    external_reference: reference,
    transaction_amount: 14.99,
    currency_id: 'BRL',
  }] }, target), []);
  assert.equal(reconcileAuthorizedPayments({ results: [{
    preapproval_id: target.providerSubscriptionId,
    external_reference: reference,
    transaction_amount: 99,
    currency_id: 'BRL',
    payment: { id: 'wrong', status: 'approved' },
  }] }, target), null);
});
