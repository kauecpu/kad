import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaymentActionScope, ownedPaymentAuthorization } from '../src/core/payment-actions.ts';
import { createCheckoutRequestScope, withPaymentTimeout } from '../src/core/payment-polling.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

for (const action of ['consultar', 'cancelar', 'iniciar checkout']) {
  test(`${action}: resposta antiga não altera conta nova nem redireciona`, async () => {
    let context = { userId: 'a', route: '/perfil/planos' };
    const scope = createPaymentActionScope(() => context);
    const request = scope.begin();
    const pending = deferred<string>();
    let applied = false;
    const result = pending.promise.then(() => { if (request.isCurrent()) applied = true; });
    context = { ...context, userId: 'b' };
    scope.sync();
    pending.resolve('success');
    await result;
    assert.equal(applied, false);
  });
}

test('sair e voltar à mesma rota ou conta não revive uma ação manual', () => {
  let context = { userId: 'a', route: '/perfil/planos' };
  const scope = createPaymentActionScope(() => context);
  const original = scope.begin();
  context = { ...context, route: '/inicio' };
  scope.sync();
  context = { userId: 'a', route: '/perfil/planos' };
  assert.equal(original.isCurrent(), false);
  const next = scope.begin();
  scope.clear(); // Logout is invalidated before its asynchronous request.
  assert.equal(next.isCurrent(), false);
});

test('consulta anterior não sobrescreve cancelamento nem retry mais recente', () => {
  const scope = createPaymentActionScope(() => ({ userId: 'a', route: '/perfil/planos' }));
  const refresh = scope.begin();
  const cancel = scope.begin();
  assert.equal(refresh.isCurrent(), false);
  refresh.finish();
  assert.equal(cancel.isCurrent(), true);
  const retry = scope.begin();
  assert.equal(cancel.isCurrent(), false);
  assert.equal(retry.isCurrent(), true);
});

test('ação manual invalida também o polling iniciado antes dela', () => {
  const polling = createCheckoutRequestScope();
  const oldRead = polling.begin('checkout-a', 'a');
  const manual = createPaymentActionScope(() => ({ userId: 'a', route: '/perfil/planos' }), polling.clear);
  const cancel = manual.begin();
  assert.equal(oldRead(), false);
  assert.equal(cancel.isCurrent(), true);
});

test('leitura posterior ao cancelamento também é descartada se a conta mudar', async () => {
  let context = { userId: 'a', route: '/perfil/planos' };
  const scope = createPaymentActionScope(() => context);
  const request = scope.begin();
  assert.equal(request.isCurrent(), true); // Remote cancellation acknowledged.
  const read = deferred<string>();
  let applied = false;
  const result = read.promise.then(() => { if (request.isCurrent()) applied = true; });
  context = { ...context, userId: 'b' };
  read.resolve('subscription-a');
  await result;
  assert.equal(applied, false);
});

test('mutação não usa sessão de outra conta nem visitante', async () => {
  assert.equal(await ownedPaymentAuthorization('a', () => true,
    async () => ({ user: { id: 'b' }, access_token: 'synthetic-b' })), null);
  assert.equal(await ownedPaymentAuthorization('a', () => true, async () => null), null);
  assert.deepEqual(await ownedPaymentAuthorization('a', () => true,
    async () => ({ user: { id: 'a' }, access_token: 'synthetic-a' })), { Authorization: 'Bearer synthetic-a' });
});

test('timeout encerra a intenção e impede envio tardio após carregar sessão', async () => {
  const scope = createPaymentActionScope(() => ({ userId: 'a', route: '/perfil/planos' }));
  const request = scope.begin();
  const session = deferred<{ user: { id: string }; access_token: string } | null>();
  const authorization = ownedPaymentAuthorization('a', request.isCurrent, () => session.promise);
  await assert.rejects(withPaymentTimeout(authorization, 5), /payment_read_timeout/);
  request.finish();
  session.resolve({ user: { id: 'a' }, access_token: 'synthetic-a' });
  assert.equal(await authorization, null);
});
