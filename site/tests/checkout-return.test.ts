import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authRouteWithCheckout,
  checkoutReturnFromRoute,
  clearCheckoutReturn,
  confirmationRouteWithCheckout,
  readCheckoutReturn,
  rememberCheckoutReturn,
  validateCheckoutReturn,
} from '../src/core/checkout-return.ts';

const checkout = 'c021c248-4ef6-4138-a73a-8cbe60ae082a';
const target = `/perfil/planos?checkout=${checkout}`;

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('aceita somente o retorno interno exato de um checkout válido', () => {
  assert.equal(validateCheckoutReturn(target), target);
  assert.equal(validateCheckoutReturn(`https://evil.invalid${target}`), null);
  assert.equal(validateCheckoutReturn(`${target}&next=https://evil.invalid`), null);
  assert.equal(validateCheckoutReturn(`${target}&checkout=${checkout}`), null);
  assert.equal(validateCheckoutReturn(`${target}#approved`), null);
  assert.equal(validateCheckoutReturn('/perfil/planos?checkout=approved'), null);
});

test('preserva o checkout durante login e o remove ao finalizar', () => {
  const storage = memoryStorage();
  assert.equal(rememberCheckoutReturn(storage, target), target);
  assert.equal(readCheckoutReturn(storage), target);
  assert.equal(authRouteWithCheckout('/entrar', target), `/entrar?returnTo=${encodeURIComponent(target)}`);
  assert.equal(confirmationRouteWithCheckout(target), `/confirmar-email?returnTo=${encodeURIComponent(target)}`);
  assert.equal(confirmationRouteWithCheckout('https://evil.invalid'), '/confirmar-email');
  clearCheckoutReturn(storage);
  assert.equal(readCheckoutReturn(storage), null);
});

test('extrai contexto apenas da rota de planos', () => {
  assert.equal(checkoutReturnFromRoute({ pathname: '/perfil/planos', search: `?checkout=${checkout}`, params: { checkout } }), target);
  assert.equal(checkoutReturnFromRoute({ pathname: '/inicio', search: `?checkout=${checkout}`, params: { checkout } }), null);
});
