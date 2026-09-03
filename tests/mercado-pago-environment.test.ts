import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPaymentReturnUrl,
  mercadoPagoAccountMode,
  paymentReturnUrl,
  selectMercadoPagoPayerEmail,
  validateWebhookSignature,
} from '../supabase/functions/_shared/mercado-pago.ts';
import { webhookEnvironmentMatches } from '../supabase/functions/_shared/mercado-pago-webhook.ts';

const checkoutId = '00000000-0000-4000-8000-000000000001';
const userEmail = 'account@example.invalid';
const testEmail = 'test_payer@testuser.com';

test('conta de teste com live_mode=true preserva comprador de teste e retorno local', () => {
  assert.equal(mercadoPagoAccountMode('test', 'true'), 'test');
  assert.equal(selectMercadoPagoPayerEmail(userEmail, testEmail, 'test', 'true'), testEmail);
  assert.equal(
    buildPaymentReturnUrl('http://127.0.0.1:5182', checkoutId, 'test'),
    `http://127.0.0.1:5182/perfil/planos?checkout=${checkoutId}`
  );
  assert.equal(webhookEnvironmentMatches('true', true), true);
  assert.equal(webhookEnvironmentMatches('true', false), false);
});

test('contas de teste exigem comprador reservado independentemente do live_mode', () => {
  for (const liveMode of ['true', 'false']) {
    assert.equal(selectMercadoPagoPayerEmail(userEmail, testEmail, 'test', liveMode), testEmail);
    for (const payer of [undefined, '', userEmail, 'payer@testuser.com.evil.invalid']) {
      assert.throws(() => selectMercadoPagoPayerEmail(userEmail, payer, 'test', liveMode));
    }
  }
});

test('produção exige live_mode=true e não permite retorno HTTP nem em loopback', () => {
  assert.equal(selectMercadoPagoPayerEmail(userEmail, testEmail, 'production', 'true'), userEmail);
  assert.throws(() => mercadoPagoAccountMode('production', 'false'));
  for (const host of ['localhost', '127.0.0.1', 'example.invalid']) {
    assert.throws(() => buildPaymentReturnUrl(`http://${host}`, checkoutId, 'production'));
  }
});

test('configuração ausente ou ambígua falha fechada sem inferir ambiente pelo tipo de conta', () => {
  for (const mode of [undefined, '', 'false', 'sandbox', 'TEST', ' test ']) {
    assert.throws(() => mercadoPagoAccountMode(mode, 'true'));
    assert.throws(() => selectMercadoPagoPayerEmail(userEmail, testEmail, mode, 'true'));
  }
  for (const liveMode of [undefined, '', 'test', 'TRUE', ' true ', '1']) {
    assert.throws(() => mercadoPagoAccountMode('test', liveMode));
    assert.equal(webhookEnvironmentMatches(liveMode, true), false);
    assert.equal(webhookEnvironmentMatches(liveMode, false), false);
  }
  assert.equal(webhookEnvironmentMatches('false', false), true);
  assert.equal(webhookEnvironmentMatches('false', true), false);
});

test('retorno de teste recusa protocolos e hosts que não são HTTP loopback ou HTTPS', () => {
  for (const url of ['ftp://localhost', 'file://localhost', 'http://localhost.evil.invalid']) {
    assert.throws(() => buildPaymentReturnUrl(url, checkoutId, 'test'));
  }
});

test('adaptador de retorno lê o modo da conta separado do live_mode', () => {
  const scope = globalThis as typeof globalThis & {
    Deno?: { env: { get(name: string): string | undefined } };
  };
  const previous = scope.Deno;
  const settings: Record<string, string> = {
    KAD_WEB_APP_URL: 'http://localhost:5182',
    MERCADO_PAGO_ACCOUNT_MODE: 'test',
    MERCADO_PAGO_LIVE_MODE: 'true',
  };
  scope.Deno = { env: { get: (name) => settings[name] } };
  try {
    assert.equal(paymentReturnUrl(checkoutId), `http://localhost:5182/perfil/planos?checkout=${checkoutId}`);
    delete settings.MERCADO_PAGO_ACCOUNT_MODE;
    assert.throws(() => paymentReturnUrl(checkoutId));
  } finally {
    if (previous) scope.Deno = previous;
    else delete scope.Deno;
  }
});

test('configuração do ambiente não substitui a autenticação HMAC', async () => {
  const secret = 'synthetic-unit-test-only';
  const requestId = 'unit-request';
  const dataId = 'UNIT-RESOURCE';
  const ts = '1700000000';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`id:unit-resource;request-id:${requestId};ts:${ts};`));
  const hash = Buffer.from(bytes).toString('hex');
  const signature = `ts=${ts},v1=${hash}`;
  assert.equal(await validateWebhookSignature({ signature, requestId, dataId, secret }), true);
  assert.equal(await validateWebhookSignature({ signature, requestId, dataId: 'other', secret }), false);
  assert.equal(await validateWebhookSignature({ signature, requestId, dataId, secret: 'different' }), false);
  assert.equal(await validateWebhookSignature({ signature: null, requestId, dataId, secret }), false);
});
