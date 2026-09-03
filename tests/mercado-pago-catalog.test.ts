import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPaymentReturnUrl,
  isMercadoPagoTestPayerEmail,
  mercadoPagoRequest,
  MercadoPagoTimeoutError,
  paymentPlan,
} from '../supabase/functions/_shared/mercado-pago.ts';

const checkoutId = '00000000-0000-4000-8000-000000000001';

test('catálogo do Mercado Pago aceita somente plano e ciclo definidos no servidor', () => {
  assert.equal(paymentPlan('platinum', 'monthly')?.amountCents, 1499);
  assert.equal(paymentPlan('platinum', 'quarterly')?.frequency, 3);
  assert.equal(paymentPlan('platinum', 'annual')?.frequency, 12);
  assert.equal(paymentPlan('diamond', 'monthly')?.amountCents, 1499);
  assert.equal(paymentPlan('diamond', 'quarterly')?.amountCents, 3999);
  assert.equal(paymentPlan('diamond', 'annual')?.amountCents, 14999);
  assert.equal(paymentPlan('diamond', 'weekly'), null);
  assert.equal(paymentPlan('basic', 'monthly'), null);
});

test('retorno de pagamento exige HTTPS fora do desenvolvimento local', () => {
  assert.equal(
    buildPaymentReturnUrl('https://app.kadconcursos.com.br', checkoutId, 'production'),
    `https://app.kadconcursos.com.br/perfil/planos?checkout=${checkoutId}`
  );
  assert.equal(
    buildPaymentReturnUrl('http://127.0.0.1:5179', checkoutId, 'test'),
    `http://127.0.0.1:5179/perfil/planos?checkout=${checkoutId}`
  );
  assert.throws(
    () => buildPaymentReturnUrl('http://app.kadconcursos.com.br', checkoutId, 'test'),
    /must use HTTPS/
  );
});

test('homologação aceita apenas comprador de teste do Mercado Pago', () => {
  assert.equal(isMercadoPagoTestPayerEmail('test_user_123@testuser.com'), true);
  assert.equal(isMercadoPagoTestPayerEmail('cliente@gmail.com'), false);
  assert.equal(isMercadoPagoTestPayerEmail('invalido'), false);
});

test('timeout também interrompe a leitura do corpo da resposta do provedor', async () => {
  const scope = globalThis as typeof globalThis & {
    Deno?: { env: { get(name: string): string | undefined } };
  };
  const originalDeno = scope.Deno;
  const originalFetch = globalThis.fetch;
  scope.Deno = { env: { get: () => 'token-de-teste' } };
  globalThis.fetch = (async (_input, init) => ({
    ok: true,
    status: 200,
    json: () => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
  }) as Response) as typeof fetch;

  try {
    await assert.rejects(
      mercadoPagoRequest('/preapproval/test', {}, 10),
      MercadoPagoTimeoutError
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDeno) scope.Deno = originalDeno;
    else delete scope.Deno;
  }
});
