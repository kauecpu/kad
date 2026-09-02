import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPaymentReturnUrl,
  isMercadoPagoTestPayerEmail,
  paymentPlan,
} from '../supabase/functions/_shared/mercado-pago.ts';

const checkoutId = '00000000-0000-4000-8000-000000000001';

test('catálogo do Mercado Pago aceita somente plano e ciclo definidos no servidor', () => {
  assert.equal(paymentPlan('diamond', 'monthly')?.amountCents, 1499);
  assert.equal(paymentPlan('diamond', 'quarterly')?.amountCents, 3999);
  assert.equal(paymentPlan('diamond', 'annual')?.amountCents, 14999);
  assert.equal(paymentPlan('diamond', 'weekly'), null);
  assert.equal(paymentPlan('basic', 'monthly'), null);
});

test('retorno de pagamento exige HTTPS fora do desenvolvimento local', () => {
  assert.equal(
    buildPaymentReturnUrl('https://app.kadconcursos.com.br', checkoutId, true),
    `https://app.kadconcursos.com.br/perfil/planos?checkout=${checkoutId}`
  );
  assert.equal(
    buildPaymentReturnUrl('http://127.0.0.1:5179', checkoutId, false),
    `http://127.0.0.1:5179/perfil/planos?checkout=${checkoutId}`
  );
  assert.throws(
    () => buildPaymentReturnUrl('http://app.kadconcursos.com.br', checkoutId, false),
    /must use HTTPS/
  );
});

test('homologação aceita apenas comprador de teste do Mercado Pago', () => {
  assert.equal(isMercadoPagoTestPayerEmail('test_user_123@testuser.com'), true);
  assert.equal(isMercadoPagoTestPayerEmail('cliente@gmail.com'), false);
  assert.equal(isMercadoPagoTestPayerEmail('invalido'), false);
});
