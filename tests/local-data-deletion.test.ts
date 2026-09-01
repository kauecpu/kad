import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const appProvider = source('../providers/app-provider.tsx');
const simulationProvider = source('../providers/simulation-provider.tsx');
const profile = source('../app/(tabs)/perfil.tsx');
const deleteAccount = source('../app/perfil/excluir-conta.tsx');
const localData = source('../lib/local-user-data.ts');

test('as duas ações destrutivas reutilizam a limpeza local centralizada', () => {
  assert.match(appProvider, /await eraseLocalUserData\(ownerId\)/);
  assert.match(profile, /clearSimulationData\(\), deleteAccount\(\)/);
  assert.match(deleteAccount, /clearSimulationData\(\), deleteAccount\(\)/);
  assert.match(localData, /localUserDataInventory\(ownerId, physicalKeys\)/);
  assert.match(localData, /protectedStorage\.deleteOwnerKey\(ownerId\)/);
  assert.match(simulationProvider, /setHydratedStorageKey\(null\)/);
});
