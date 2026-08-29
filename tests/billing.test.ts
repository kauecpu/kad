import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANDROID_PRODUCT_IDS,
  endBilling,
  fetchStoreSubscriptions,
  initBilling,
  observeStorePurchases,
  requestStorePurchase,
} from '../lib/billing.ts';

test('o mapa de produtos mantém SKU estável por plano e ciclo', () => {
  assert.equal(ANDROID_PRODUCT_IDS.diamond.monthly, 'kad_diamond_monthly');
  assert.equal(ANDROID_PRODUCT_IDS.diamond.quarterly, 'kad_diamond_quarterly');
  assert.equal(ANDROID_PRODUCT_IDS.diamond.annual, 'kad_diamond_annual');
  assert.equal(ANDROID_PRODUCT_IDS.circle.monthly, 'kad_circle_monthly');
  assert.equal(ANDROID_PRODUCT_IDS.circle.quarterly, 'kad_circle_quarterly');
  assert.equal(ANDROID_PRODUCT_IDS.circle.annual, 'kad_circle_annual');
});

test('operações de Billing permanecem explicitamente desabilitadas até a validação nativa', async () => {
  const results = await Promise.all([
    initBilling(),
    endBilling(),
    fetchStoreSubscriptions(['kad_diamond_monthly']),
    requestStorePurchase('kad_diamond_monthly'),
  ]);

  for (const result of results) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'not_ready');
  }
});

test('observador fornece limpeza idempotente sem registrar listener nativo', () => {
  let received = 0;
  const cleanup = observeStorePurchases(() => {
    received += 1;
  });

  cleanup();
  cleanup();
  assert.equal(received, 0);
});
