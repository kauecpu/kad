import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APP_FEATURES,
  APP_FEATURE_GROUPS,
  featuresForGroup,
} from '../lib/app-feature-catalog.ts';

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
