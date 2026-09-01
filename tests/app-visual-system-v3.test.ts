import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const theme = source('../constants/theme.ts');
const signalPath = new NodeURL('../components/ui/kad-signal.tsx', import.meta.url);
const signal = source('../components/ui/kad-signal.tsx');
const card = source('../components/ui/card.tsx');
const section = source('../components/ui/section.tsx');
const screenHeader = source('../components/ui/screen-header.tsx');
const stackHeader = source('../components/ui/stack-header.tsx');
const searchField = source('../components/ui/search-field.tsx');

test('os temas claro e escuro expõem superfícies e cores semânticas equivalentes', () => {
  for (const token of [
    'surfaceRaised',
    'energy',
    'energySoft',
    'energyStrong',
    'onEnergy',
    'info',
    'infoSoft',
    'focusRing',
  ]) {
    assert.equal(theme.match(new RegExp(`${token}:`, 'g'))?.length, 2, `${token} precisa existir nos dois temas`);
  }
});

test('a assinatura do KAD é pequena, tokenizada e ignorada por leitores de tela', () => {
  assert.ok(existsSync(signalPath));
  assert.match(signal, /export function KadSignal/);
  assert.match(signal, /colors\.primary/);
  assert.match(signal, /colors\.energyStrong/);
  assert.match(signal, /accessible=\{false\}/);
  assert.match(signal, /accessibilityElementsHidden/);
  assert.match(signal, /importantForAccessibility="no-hide-descendants"/);
  assert.doesNotMatch(signal, /#[0-9A-Fa-f]{6}/);
});

test('a linguagem compartilhada alcança cabeçalhos, seções e superfícies', () => {
  assert.match(screenHeader, /<KadSignal/);
  assert.match(screenHeader, /backgroundColor: colors\.surface/);
  assert.match(stackHeader, /<KadSignal compact/);
  assert.match(section, /<KadSignal compact/);
  assert.match(card, /tone\?: 'default' \| 'subtle' \| 'brand' \| 'energy'/);
  assert.match(card, /colors\.surfaceRaised/);
});

test('campos de busca exibem foco visível sem depender apenas de cor de fundo', () => {
  assert.match(searchField, /onFocus=\{\(\) => setFocused\(true\)\}/);
  assert.match(searchField, /onBlur=\{\(\) => setFocused\(false\)\}/);
  assert.match(searchField, /borderColor: focused \? colors\.focusRing : colors\.border/);
  assert.match(searchField, /borderWidth: 1/);
});
