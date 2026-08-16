import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const simulations = source('../app/(tabs)/simulados.tsx');
const profile = source('../app/(tabs)/perfil.tsx');

test('o card de montar simulado mantém estados e CTA dentro da nova superfície', () => {
  assert.match(simulations, /styles\.builderGradient/);
  assert.match(simulations, /styles\.builderActionRow/);
  assert.match(simulations, /Verificando seu plano para montar simulados/);
  assert.match(simulations, /Conhecer planos com simulados personalizados/);
  assert.match(simulations, /canUseSimulations[\s\S]*?Configurar prova[\s\S]*?Conhecer planos/);
});

test('o cartão de identidade preserva perfil, plano e ação acessível', () => {
  assert.match(profile, /IDENTIDADE KAD/);
  assert.match(profile, /styles\.identityRail/);
  assert.match(profile, /styles\.primaryActionGradient/);
  assert.match(profile, /accessibilityLabel=\{primaryAction\.label\}/);
  assert.match(profile, /accessibilityHint=\{primaryAction\.description\}/);
  assert.match(profile, /subscription\.plan === 'diamond'/);
});
