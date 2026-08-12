import assert from 'node:assert/strict';
import test from 'node:test';

import { decideCheckoutAction } from '../supabase/functions/_shared/payment-checkout.ts';

const now = new Date('2026-08-12T02:00:00.000Z').getTime();
const baseCheckout = {
  id: '00000000-0000-4000-8000-000000000001',
  plan: 'diamond',
  billing_cycle: 'monthly',
  provider_subscription_id: 'provider-subscription-1',
  checkout_url: 'https://www.mercadopago.com.br/subscriptions/checkout',
  status: 'pending',
  created_at: '2026-08-12T01:59:00.000Z',
  expires_at: '2026-08-12T03:00:00.000Z',
};

test('reutiliza checkout seguro quando plano e ciclo são iguais', () => {
  assert.equal(
    decideCheckoutAction(baseCheckout, { plan: 'diamond', billingCycle: 'monthly' }, now),
    'reuse'
  );
});

test('alternância mensal/anual exige uma nova tentativa controlada', () => {
  assert.equal(
    decideCheckoutAction(baseCheckout, { plan: 'diamond', billingCycle: 'annual' }, now),
    'replace'
  );
});

test('requisição concorrente não substitui checkout ainda em criação', () => {
  assert.equal(
    decideCheckoutAction(
      { ...baseCheckout, status: 'creating', checkout_url: null },
      { plan: 'diamond', billingCycle: 'annual' },
      now
    ),
    'in_progress'
  );
});

test('checkout expirado não é reutilizado', () => {
  assert.equal(
    decideCheckoutAction(
      { ...baseCheckout, expires_at: '2026-08-12T01:00:00.000Z' },
      { plan: 'diamond', billingCycle: 'monthly' },
      now
    ),
    'replace'
  );
});
