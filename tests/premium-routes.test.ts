import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const player = source('../app/questoes/simulado/index.tsx');
const result = source('../app/questoes/simulado/resultado.tsx');
const configure = source('../app/questoes/simulado/configurar.tsx');
const simulationsTab = source('../app/(tabs)/simulados.tsx');
const home = source('../app/(tabs)/inicio.tsx');

test('rotas diretas do simulado verificam o acesso premium', () => {
  for (const screen of [player, result]) {
    assert.match(screen, /canUseSimulations/);
    assert.match(screen, /subscriptionLoading/);
    assert.match(screen, /router\.replace\('\/perfil\/planos'\)/);
  }

  assert.match(configure, /subscriptionLoading/);
  assert.match(configure, /if \(subscriptionLoading\) return/);
  assert.match(configure, /disabled=\{subscriptionLoading \|\| candidates\.length === 0\}/);
});

test('atalhos de simulado salvo nao contornam o acesso premium', () => {
  assert.match(simulationsTab, /canUseSimulations[\s\S]*?router\.push/);
  assert.match(home, /session && isPremium/);
});
