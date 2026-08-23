import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import {
  APP_DRAWER_GROUPS,
  APP_DRAWER_ITEMS,
  drawerItemsForGroup,
  drawerWidth,
  isDrawerRouteActive,
} from '../lib/app-feature-catalog.ts';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

test('o drawer apresenta todas as áreas na ordem e nos grupos aprovados', () => {
  assert.deepEqual(
    APP_DRAWER_GROUPS.map(({ id, title }) => ({ id, title })),
    [
      { id: 'main', title: 'Principal' },
      { id: 'progress', title: 'Acompanhar' },
      { id: 'study', title: 'Outras formas de estudar' },
      { id: 'account', title: 'Conta' },
    ]
  );
  assert.deepEqual(
    APP_DRAWER_ITEMS.map(({ title }) => title),
    ['Início', 'Questões', 'Concursos', 'Simulados', 'Ranking', 'Trilhas', 'Redação', 'Biblioteca', 'Perfil']
  );
  assert.deepEqual(
    drawerItemsForGroup('main').map(({ title }) => title),
    ['Início', 'Questões', 'Concursos', 'Simulados']
  );
  assert.deepEqual(drawerItemsForGroup('account').map(({ title }) => title), ['Perfil']);
});

test('a largura ocupa 84% no celular e respeita o máximo de 336 dp', () => {
  assert.equal(drawerWidth(320), 268.8);
  assert.equal(drawerWidth(390), 327.6);
  assert.equal(drawerWidth(768), 336);
});

test('o destaque acompanha rotas canônicas, descendentes e o alias antigo', () => {
  assert.equal(isDrawerRouteActive('/inicio', '/inicio'), true);
  assert.equal(isDrawerRouteActive('/questoes/Português', '/questoes'), true);
  assert.equal(isDrawerRouteActive('/perfil/editar', '/perfil'), true);
  assert.equal(isDrawerRouteActive('/rank', '/ranking'), true);
  assert.equal(isDrawerRouteActive('/simulados', '/questoes'), false);
});

test('o layout oficial remove Tabs e registra Drawer com gesto, overlay e conteúdo customizado', () => {
  const layout = source('../app/(tabs)/_layout.tsx');

  assert.match(layout, /import \{ Drawer \} from 'expo-router\/drawer'/);
  assert.doesNotMatch(layout, /\bTabs\b|tabBar/);
  assert.match(layout, /drawerContent=\{\(props\) => <KadDrawerContent \{\.\.\.props\} \/>\}/);
  assert.match(layout, /swipeEnabled: true/);
  assert.match(layout, /swipeEdgeWidth:/);
  assert.match(layout, /overlayColor: colors\.overlay/);
  assert.match(layout, /drawerWidth\(width\)/);
});

test('o conteúdo rolável fecha o drawer sem aguardar a animação e destaca a rota atual', () => {
  const drawer = source('../components/kad-drawer-content.tsx');

  assert.match(drawer, /DrawerContentScrollView/);
  assert.match(drawer, /kad-icon-v4\.png/);
  assert.doesNotMatch(drawer, /kad-symbol-v3\.png/);
  assert.match(drawer, /navigation\.closeDrawer\(\)/);
  assert.match(drawer, /router\.navigate\(item\.href\)/);
  assert.match(drawer, /isDrawerRouteActive\(pathname, item\.href\)/);
  assert.match(drawer, /accessibilityState=\{\{ selected: active \}\}/);
  assert.match(drawer, /'aria-current': 'page'/);
  assert.doesNotMatch(drawer, /numberOfLines/);
  const minHeight = drawer.match(/drawerItem:\s*\{[\s\S]*?minHeight:\s*(\d+)/);
  assert.ok(minHeight && Number(minHeight[1]) >= 48);
});

test('o cabeçalho oferece botão explícito de menu com alvo mínimo', () => {
  const header = source('../components/ui/screen-header.tsx');
  const menuButton = source('../components/ui/drawer-menu-button.tsx');

  assert.match(header, /onMenu/);
  assert.match(header, /<DrawerMenuButton onPress=\{onMenu\}/);
  assert.match(menuButton, /accessibilityLabel="Abrir menu"/);
  assert.match(menuButton, /accessibilityRole="button"/);
  assert.match(menuButton, /width:\s*48/);
  assert.match(menuButton, /height:\s*48/);
});

test('todas as telas principais conectam o botão ao Drawer sem remover ações existentes', () => {
  for (const route of ['inicio', 'questoes', 'simulados', 'explorar']) {
    const screen = source(`../app/(tabs)/${route}.tsx`);
    assert.match(screen, /useOpenAppDrawer\(\)/, `${route} deve obter a ação do Drawer`);
    assert.match(screen, /onMenu=\{openMenu\}/, `${route} deve expor o botão Abrir menu`);
  }

  const contests = source('../app/(tabs)/concursos.tsx');
  assert.match(contests, /useOpenAppDrawer\(\)/);
  assert.match(contests, /<DrawerMenuButton onPress=\{openMenu\} \/>/);

  assert.match(source('../app/(tabs)/inicio.tsx'), /<Avatar/);
  assert.match(source('../app/(tabs)/questoes.tsx'), /accessibilityLabel="Abrir ranking de questões"/);
  assert.match(contests, /accessibilityLabel=\{`Abrir concursos salvos/);
});

test('a rota Explorar continua disponível, mas não aparece no catálogo do drawer', () => {
  assert.equal(APP_DRAWER_ITEMS.some(({ href }) => String(href) === '/explorar'), false);
  assert.match(source('../app/(tabs)/_layout.tsx'), /name="explorar"/);
  assert.match(source('../app/(tabs)/explorar.tsx'), /export default function ExploreScreen/);
});

test('a tela Início preserva seus cards fortes e resumos', () => {
  const home = source('../app/(tabs)/inicio.tsx');

  assert.match(home, /<FeaturedCard/);
  assert.match(home, /intensity="strong"/);
  assert.match(home, /styles\.summaryGrid/);
  assert.match(home, /<StudyMomentumCard/);
});
