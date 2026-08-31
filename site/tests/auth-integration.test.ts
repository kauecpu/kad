import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSignupMetadata, displayNameFromMetadata } from '../src/core/auth-profile.ts';
import { signOutLocally } from '../src/core/auth-actions.ts';

test('cadastro web usa a mesma chave de nome que o app e o trigger do banco', () => {
  assert.deepEqual(buildSignupMetadata('  Ana Lima  '), { name: 'Ana Lima' });
});

test('perfil aceita nome novo e metadado legado sem perder a identificação', () => {
  assert.equal(displayNameFromMetadata({ name: 'Nome do app', full_name: 'Nome antigo' }, 'Fallback'), 'Nome do app');
  assert.equal(displayNameFromMetadata({ full_name: 'Nome antigo' }, 'Fallback'), 'Nome antigo');
  assert.equal(displayNameFromMetadata({}, 'Fallback'), 'Fallback');
});

test('logout web encerra somente a sessão local', async () => {
  let received: unknown;
  await signOutLocally({
    signOut: async (options) => { received = options; },
  });
  assert.deepEqual(received, { scope: 'local' });
});
