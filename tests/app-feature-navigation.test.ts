import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import {
  APP_FEATURES,
  APP_FEATURE_GROUPS,
  APP_PRIMARY_TABS,
  APP_ROUTE_ALIASES,
  featuresForGroup,
} from '../lib/app-feature-catalog.ts';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

test('o catálogo oferece todas as funções aprovadas na ordem de descoberta', () => {
  assert.deepEqual(
    APP_FEATURES.map(({ id }) => id),
    ['questions', 'contests', 'simulations', 'ranking', 'trails', 'essay', 'library', 'profile']
  );
  assert.deepEqual(
    APP_FEATURE_GROUPS.map(({ id }) => id),
    ['practice', 'progress', 'other', 'account']
  );
});

test('a navegação primária mantém cinco destinos na ordem aprovada', () => {
  assert.deepEqual(APP_PRIMARY_TABS, [
    { name: 'inicio', title: 'Início' },
    { name: 'questoes', title: 'Questões' },
    { name: 'concursos', title: 'Concursos' },
    { name: 'simulados', title: 'Simulados' },
    { name: 'explorar', title: 'Explorar' },
  ]);
});

test('o endereço antigo de Rank resolve para a tela canônica de Ranking', () => {
  assert.deepEqual(APP_ROUTE_ALIASES, { rank: '/ranking' });
});

test('cada função possui uma rota canônica e pertence a um único grupo', () => {
  assert.equal(new Set(APP_FEATURES.map(({ id }) => id)).size, 8);
  assert.equal(new Set(APP_FEATURES.map(({ href }) => href)).size, 8);

  for (const feature of APP_FEATURES) {
    assert.ok(feature.title.length > 0);
    assert.ok(feature.description.length > 0);
    assert.ok(feature.href.startsWith('/'));
    assert.deepEqual(featuresForGroup(feature.group).filter(({ id }) => id === feature.id), [feature]);
  }
});

test('o card de função mantém ação acessível e texto sem truncamento', () => {
  const card = source('../components/ui/feature-link-card.tsx');

  assert.match(card, /accessibilityRole="button"/);
  assert.match(card, /accessibilityLabel=\{`\$\{title\}\. \$\{description\}`\}/);
  const minHeight = card.match(/minHeight:\s*(\d+)/);
  assert.ok(minHeight && Number(minHeight[1]) >= 44);
  assert.match(card, /flexShrink:\s*1/);
  assert.doesNotMatch(card, /numberOfLines/);
});
