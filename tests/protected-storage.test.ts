import assert from 'node:assert/strict';
import test from 'node:test';

import { localUserDataInventory } from '../lib/local-user-data-keys.ts';
import {
  createProtectedStorage,
  protectedOwnerKey,
  protectedPhysicalKey,
} from '../lib/protected-storage-core.ts';

function memoryStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      values.set(key, value);
    },
    async removeItem(key: string) {
      values.delete(key);
    },
  };
}

function deterministicRandom() {
  let counter = 0;
  return async (length: number) => {
    counter += 1;
    return Uint8Array.from({ length }, (_, index) => (counter + index) % 256);
  };
}

const validJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

test('payloads privados são cifrados e recuperados sem texto claro no AsyncStorage', async () => {
  const storage = memoryStore();
  const keyStore = memoryStore();
  const protectedStorage = createProtectedStorage({
    storage,
    keyStore,
    randomBytes: deterministicRandom(),
  });
  const logicalKey = '@kad/app-state/v2:user-a';
  const plaintext = JSON.stringify({ profile: { email: 'aluna@example.com' }, answers: { q1: 'A' } });

  await protectedStorage.setItem(logicalKey, 'user-a', plaintext);
  const physical = storage.values.get(protectedPhysicalKey(logicalKey));
  assert.ok(physical);
  assert.doesNotMatch(physical, /aluna@example\.com|profile|answers|q1/);
  assert.equal(await protectedStorage.getItem(logicalKey, 'user-a', validJson), plaintext);
  assert.ok(keyStore.values.has(protectedOwnerKey('user-a')));
});

test('nonce é único a cada gravação autenticada', async () => {
  const storage = memoryStore();
  const protectedStorage = createProtectedStorage({
    storage,
    keyStore: memoryStore(),
    randomBytes: deterministicRandom(),
  });
  const logicalKey = '@kad/essay-draft/user-a/tema-1';
  await protectedStorage.setItem(logicalKey, 'user-a', JSON.stringify({ content: 'redação' }));
  const first = JSON.parse(storage.values.get(protectedPhysicalKey(logicalKey))!);
  await protectedStorage.setItem(logicalKey, 'user-a', JSON.stringify({ content: 'redação' }));
  const second = JSON.parse(storage.values.get(protectedPhysicalKey(logicalKey))!);
  assert.notEqual(first.nonce, second.nonce);
});

test('gravações concorrentes do mesmo proprietário compartilham uma única chave verificada', async () => {
  const storage = memoryStore();
  const keyStore = memoryStore();
  let randomCalls = 0;
  const protectedStorage = createProtectedStorage({
    storage,
    keyStore,
    randomBytes: async (length) => {
      randomCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 2));
      return Uint8Array.from({ length }, (_, index) => (randomCalls + index) % 256);
    },
  });
  const appKey = '@kad/app-state/v2:user-a';
  const simulationKey = '@kad/simulation-history/v2:user-a';
  await Promise.all([
    protectedStorage.setItem(appKey, 'user-a', JSON.stringify({ profile: 'A' })),
    protectedStorage.setItem(simulationKey, 'user-a', JSON.stringify([{ id: 'sim-1' }])),
  ]);

  assert.equal(
    await protectedStorage.getItem(appKey, 'user-a', validJson),
    JSON.stringify({ profile: 'A' })
  );
  assert.equal(
    await protectedStorage.getItem(simulationKey, 'user-a', validJson),
    JSON.stringify([{ id: 'sim-1' }])
  );
  assert.equal(randomCalls, 3, 'uma chave e dois nonces devem ser gerados');
});

test('ciphertext adulterado falha fechado sem retornar conteúdo', async () => {
  const storage = memoryStore();
  const protectedStorage = createProtectedStorage({
    storage,
    keyStore: memoryStore(),
    randomBytes: deterministicRandom(),
  });
  const logicalKey = '@kad/simulation-history/v2:user-a';
  await protectedStorage.setItem(logicalKey, 'user-a', JSON.stringify([{ id: 'sim-1' }]));
  const physicalKey = protectedPhysicalKey(logicalKey);
  const envelope = JSON.parse(storage.values.get(physicalKey)!);
  const last = envelope.ciphertext.at(-1);
  envelope.ciphertext = `${envelope.ciphertext.slice(0, -1)}${last === '0' ? '1' : '0'}`;
  storage.values.set(physicalKey, JSON.stringify(envelope));

  await assert.rejects(() => protectedStorage.getItem(logicalKey, 'user-a', validJson));
});

test('migração valida, verifica e só então remove o texto antigo', async () => {
  const logicalKey = '@kad/essay-draft/guest/tema-1';
  const plaintext = JSON.stringify({ topicId: 'tema-1', content: 'texto legado' });
  const storage = memoryStore({ [logicalKey]: plaintext });
  const protectedStorage = createProtectedStorage({
    storage,
    keyStore: memoryStore(),
    randomBytes: deterministicRandom(),
  });

  assert.equal(await protectedStorage.getItem(logicalKey, 'guest', validJson), plaintext);
  assert.equal(storage.values.has(logicalKey), false);
  assert.ok(storage.values.has(protectedPhysicalKey(logicalKey)));
});

test('falha durante migração preserva o valor antigo', async () => {
  const logicalKey = '@kad/app-state/v1';
  const plaintext = JSON.stringify({ profile: { name: 'Legado' } });
  const base = memoryStore({ [logicalKey]: plaintext });
  const storage = {
    ...base,
    async setItem(key: string, value: string) {
      if (key === protectedPhysicalKey(logicalKey)) throw new Error('disk-full');
      base.values.set(key, value);
    },
  };
  const protectedStorage = createProtectedStorage({
    storage,
    keyStore: memoryStore(),
    randomBytes: deterministicRandom(),
  });

  assert.equal(await protectedStorage.getItem(logicalKey, 'guest', validJson), plaintext);
  assert.equal(base.values.get(logicalKey), plaintext);
});

test('exclusão remove ciphertext, texto legado e chave do proprietário', async () => {
  const logicalKey = '@kad/essay-draft/user-a/tema-1';
  const storage = memoryStore({ [logicalKey]: 'legado' });
  const keyStore = memoryStore();
  const protectedStorage = createProtectedStorage({
    storage,
    keyStore,
    randomBytes: deterministicRandom(),
  });
  await protectedStorage.setItem(logicalKey, 'user-a', JSON.stringify({ content: 'privado' }));
  await protectedStorage.removeItem(logicalKey);
  await protectedStorage.deleteOwnerKey('user-a');

  assert.equal(storage.values.has(logicalKey), false);
  assert.equal(storage.values.has(protectedPhysicalKey(logicalKey)), false);
  assert.equal(keyStore.values.has(protectedOwnerKey('user-a')), false);
});

test('exclusão aguarda gravações em curso e bloqueia novas persistências', async () => {
  const base = memoryStore();
  let releaseWrite!: () => void;
  const writeGate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  const storage = {
    ...base,
    async setItem(key: string, value: string) {
      await writeGate;
      base.values.set(key, value);
    },
  };
  const protectedStorage = createProtectedStorage({
    storage,
    keyStore: memoryStore(),
    randomBytes: deterministicRandom(),
  });
  const logicalKey = '@kad/app-state/v2:user-a';
  const inFlight = protectedStorage.setItem(logicalKey, 'user-a', JSON.stringify({ answers: {} }));
  const deletionReady = protectedStorage.beginOwnerDeletion('user-a');
  await assert.rejects(
    () => protectedStorage.setItem('@kad/essay-draft/user-a/tema-1', 'user-a', '{}'),
    /owner-deleting/
  );
  releaseWrite();
  await Promise.all([inFlight, deletionReady]);
  await protectedStorage.removeItem(logicalKey);
  await protectedStorage.deleteOwnerKey('user-a');
  assert.equal(base.values.has(protectedPhysicalKey(logicalKey)), false);
});

test('inventário de exclusão cobre estado, simulados e redações sem tocar outra conta', () => {
  const userADraft = '@kad/essay-draft/user-a/tema-1';
  const userBDraft = '@kad/essay-draft/user-b/tema-2';
  const inventory = localUserDataInventory('user-a', [
    protectedPhysicalKey(userADraft),
    protectedPhysicalKey(userBDraft),
  ]);

  assert.ok(inventory.privateLogicalKeys.includes('@kad/app-state/v2:user-a'));
  assert.ok(inventory.privateLogicalKeys.includes('@kad/simulation-session/v2:user-a'));
  assert.ok(inventory.privateLogicalKeys.includes('@kad/simulation-history/v2:user-a'));
  assert.ok(inventory.privateLogicalKeys.includes(userADraft));
  assert.equal(inventory.privateLogicalKeys.includes(userBDraft), false);
});

test('inventário guest inclui rascunhos e namespaces legados esperados', () => {
  const inventory = localUserDataInventory('guest', [
    '@kad/essay-draft/tema-antigo',
    protectedPhysicalKey('@kad/essay-draft/guest/tema-novo'),
  ]);
  assert.ok(inventory.privateLogicalKeys.includes('@kad/essay-draft/tema-antigo'));
  assert.ok(inventory.privateLogicalKeys.includes('@kad/essay-draft/guest/tema-novo'));
  assert.ok(inventory.privateLogicalKeys.includes('@kad/app-state/v1'));
  assert.ok(inventory.privateLogicalKeys.includes('@kad/simulation-session/v1'));
  assert.ok(inventory.privateLogicalKeys.includes('@kad/simulation-history/v1'));
});

test('apagar dados guest impede recuperar a redação e preserva outra conta', async () => {
  const storage = memoryStore();
  const keyStore = memoryStore();
  const protectedStorage = createProtectedStorage({
    storage,
    keyStore,
    randomBytes: deterministicRandom(),
  });
  const guestDraft = '@kad/essay-draft/guest/tema-1';
  const otherDraft = '@kad/essay-draft/user-b/tema-1';
  await protectedStorage.setItem(guestDraft, 'guest', JSON.stringify({ content: 'guest secreto' }));
  await protectedStorage.setItem(otherDraft, 'user-b', JSON.stringify({ content: 'conta B' }));

  const inventory = localUserDataInventory('guest', [...storage.values.keys()]);
  await Promise.all(inventory.privateLogicalKeys.map((key) => protectedStorage.removeItem(key)));
  await protectedStorage.deleteOwnerKey('guest');

  assert.equal(await protectedStorage.getItem(guestDraft, 'guest', validJson), null);
  assert.equal(
    await protectedStorage.getItem(otherDraft, 'user-b', validJson),
    JSON.stringify({ content: 'conta B' })
  );
});
