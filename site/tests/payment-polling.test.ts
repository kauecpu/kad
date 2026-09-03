import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutProgressAfterPolling, createCheckoutRequestScope, withPaymentTimeout } from '../src/core/payment-polling.ts';

test('retry do mesmo checkout invalida a resposta anterior', async () => {
  const scope = createCheckoutRequestScope();
  const original = scope.begin('checkout-a', 'user-a');
  let finish!: () => void;
  let applied = false;
  const oldResponse = new Promise<void>((resolve) => { finish = resolve; })
    .then(() => { if (original()) applied = true; });
  const retry = scope.begin('checkout-a', 'user-a');
  finish();
  await oldResponse;
  assert.equal(applied, false);
  assert.equal(retry(), true);
});

test('troca de usuário reinicia consulta, mesmo mantendo o checkout na URL', () => {
  const scope = createCheckoutRequestScope();
  const original = scope.begin('checkout-a', 'user-a');
  assert.equal(scope.matches('checkout-a', 'user-b'), false);
  scope.begin('checkout-a', 'user-b');
  assert.equal(original(), false);
  assert.equal(scope.matches('checkout-a', 'user-b'), true);
});

test('sair e voltar à rota ou conta não ressuscita uma consulta antiga', () => {
  const scope = createCheckoutRequestScope();
  const original = scope.begin('checkout-a', 'user-a');
  scope.clear();
  assert.equal(original(), false);
  scope.begin('checkout-a', 'user-a');
  assert.equal(original(), false);
});

test('consulta que não responde tem prazo e sua resposta tardia é ignorada', async () => {
  let finish!: (value: string) => void;
  const request = new Promise<string>((resolve) => { finish = resolve; });
  await assert.rejects(withPaymentTimeout(request, 5), /payment_read_timeout/);
  finish('late');
  assert.equal(await withPaymentTimeout(Promise.resolve('current'), 20), 'current');
});

test('fim das tentativas não transforma falha de leitura em pagamento pendente', () => {
  assert.deepEqual(checkoutProgressAfterPolling(null, null), {
    status: 'unavailable', reason: 'provider_unavailable',
  });
  assert.deepEqual(checkoutProgressAfterPolling({ status: 'pending' }, null), {
    status: 'pending', reason: null,
  });
  assert.deepEqual(checkoutProgressAfterPolling({ status: 'pending' }, 'configuration_missing'), {
    status: 'unavailable', reason: 'configuration_missing',
  });
});

test('sincronização atrasada do acesso não rebaixa uma cobrança confirmada', () => {
  assert.deepEqual(checkoutProgressAfterPolling({ status: 'approved' }, 'provider_unavailable'), {
    status: 'approved',
  });
});
