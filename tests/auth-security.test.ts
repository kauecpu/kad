import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authCodeFromUrl,
  createAuthCallbackReplayGuard,
  isAuthCallbackUrl,
} from '../lib/auth-security.ts';

const production = { allowedSchemes: ['kad'] };
const flowId = '12345678abcdef';

test('deep link de produção exige scheme, host, rota e flow id permitidos', () => {
  assert.equal(isAuthCallbackUrl('kad://auth/nova-senha?code=invalid', production), false);
  assert.equal(
    isAuthCallbackUrl(`evil://auth/nova-senha?code=x&sb_flow_id=${flowId}`, production),
    false
  );
  assert.equal(
    isAuthCallbackUrl(`kad://outro/nova-senha?code=x&sb_flow_id=${flowId}`, production),
    false
  );
  assert.equal(
    isAuthCallbackUrl(`kad://auth/rota-invalida?code=x&sb_flow_id=${flowId}`, production),
    false
  );
  assert.equal(
    isAuthCallbackUrl(`https://evil.example/auth/nova-senha?code=x&sb_flow_id=${flowId}`, production),
    false
  );
});

test('callback PKCE legítimo preserva a correlação usada na troca', () => {
  const url = `kad://auth/nova-senha?code=legitimo&sb_flow_id=${flowId}`;
  assert.equal(isAuthCallbackUrl(url, production), true);
  assert.deepEqual(authCodeFromUrl(url, production), {
    callback: 'recovery',
    code: 'legitimo',
    flowId,
    errorDescription: undefined,
  });
});

test('Expo Go é aceito somente quando habilitado explicitamente para desenvolvimento', () => {
  const url = `exp://192.168.0.10:8081/--/auth/login?code=legitimo&sb_flow_id=${flowId}`;
  assert.equal(isAuthCallbackUrl(url, production), false);
  assert.equal(isAuthCallbackUrl(url, { ...production, allowExpoGo: true }), true);
});

test('callback web exige a origem exata configurada', () => {
  const options = { ...production, webOrigin: 'http://localhost:8081' };
  assert.equal(
    isAuthCallbackUrl(`http://localhost:8081/auth/login?code=x&sb_flow_id=${flowId}`, options),
    true
  );
  assert.equal(
    isAuthCallbackUrl(`https://attacker.example/auth/login?code=x&sb_flow_id=${flowId}`, options),
    false
  );
});

test('o mesmo callback só pode ser reivindicado uma vez', () => {
  const guard = createAuthCallbackReplayGuard();
  const callback = `kad://auth/login?code=unico&sb_flow_id=${flowId}`;
  assert.equal(guard.claim(callback), true);
  assert.equal(guard.claim(callback), false);
});
