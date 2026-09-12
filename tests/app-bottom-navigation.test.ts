import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import {
  APP_PRIMARY_DESTINATIONS,
  bottomNavigationDestinationForPath,
  bottomSheetItemsForGroup,
} from '../lib/app-feature-catalog.ts';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

test('a navegação móvel segue a ordem aprovada e mantém Início no centro', () => {
  assert.deepEqual(
    APP_PRIMARY_DESTINATIONS.map(({ id, title }) => ({ id, title })),
    [
      { id: 'study', title: 'Estudar' },
      { id: 'prepare', title: 'Preparar' },
      { id: 'home', title: 'Início' },
      { id: 'progress', title: 'Acompanhar' },
      { id: 'account', title: 'Conta' },
    ]
  );
});

test('as folhas agrupam somente as rotas aprovadas e na ordem correta', () => {
  assert.deepEqual(bottomSheetItemsForGroup('study').map(({ title }) => title), [
    'Questões',
    'Simulados',
    'Trilhas',
  ]);
  assert.deepEqual(bottomSheetItemsForGroup('prepare').map(({ title }) => title), [
    'Concursos',
    'Redação',
    'Flashcards',
    'Biblioteca',
  ]);
  assert.deepEqual(bottomSheetItemsForGroup('account').map(({ title }) => title), [
    'Perfil',
    'Configurações',
  ]);
});

test('rotas canônicas, descendentes e legadas destacam o destino correto', () => {
  assert.equal(bottomNavigationDestinationForPath('/inicio'), 'home');
  assert.equal(bottomNavigationDestinationForPath('/explorar'), 'home');
  assert.equal(bottomNavigationDestinationForPath('/questoes/Português'), 'study');
  assert.equal(bottomNavigationDestinationForPath('/concursos'), 'prepare');
  assert.equal(bottomNavigationDestinationForPath('/ranking'), 'progress');
  assert.equal(bottomNavigationDestinationForPath('/rank'), 'progress');
  assert.equal(bottomNavigationDestinationForPath('/perfil/editar'), 'account');
});

test('a barra usa safe area, alvos acessíveis e folhas modais sem remover o Drawer', () => {
  const navigation = source('../components/kad-bottom-navigation.tsx');
  const layout = source('../app/(tabs)/_layout.tsx');

  assert.match(navigation, /useSafeAreaInsets\(\)/);
  assert.match(navigation, /accessibilityRole="tablist"/);
  assert.match(navigation, /accessibilityRole="tab"/);
  assert.match(navigation, /accessibilityState=\{\{ selected: active/);
  assert.match(navigation, /<Modal/);
  assert.match(navigation, /onRequestClose=\{onClose\}/);
  assert.match(navigation, /const MIN_TOUCH_TARGET = 48/);
  assert.match(layout, /<KadBottomNavigation \/>/);
  assert.match(layout, /width < 768/);
  assert.match(layout, /<Drawer/);
});
