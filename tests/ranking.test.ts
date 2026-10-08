import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import { parseRankingSnapshot, rankingInitials } from '../lib/ranking.ts';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const tabsLayout = source('../app/(tabs)/_layout.tsx');
const rankTab = source('../app/(tabs)/rank.tsx');
const rankingScreen = source('../app/(tabs)/ranking.tsx');
const settingsScreen = source('../app/(tabs)/configuracoes.tsx');
const rankingData = source('../data/ranking.ts');

test('ranking aceita somente a projeção pública esperada', () => {
  const snapshot = parseRankingSnapshot({
    period: 'month',
    entries: [{ name: 'Ana', username: 'ana', points: 120, level: 3, activityCount: 9, rank: 1 }],
    currentUser: { name: 'Kaue', username: 'kaue', points: 80, level: 2, activityCount: 6, rank: 2, isPublic: false },
    totalParticipants: 1,
    limit: 100,
    offset: 0,
  });
  assert.equal(snapshot.entries[0].points, 120);
  assert.equal(snapshot.currentUser?.isPublic, false);
  assert.deepEqual(Object.keys(snapshot.entries[0]).sort(), ['activityCount', 'level', 'name', 'points', 'rank', 'username']);
});

test('ranking recusa respostas incompletas ou com pontuação inválida', () => {
  assert.throws(() => parseRankingSnapshot({ period: 'today', entries: [], totalParticipants: -1, limit: 100, offset: 0, currentUser: null }));
  assert.throws(() => parseRankingSnapshot({ period: 'week', entries: [], totalParticipants: 0, limit: 100, offset: 0, currentUser: null }));
});

test('iniciais não dependem de um identificador interno', () => {
  assert.equal(rankingInitials('Ana Maria Silva'), 'AM');
  assert.equal(rankingInitials(''), 'K');
});

test('a tela usa backend, estados reais e nenhum participante fictício', () => {
  assert.match(rankingScreen, /loadRanking/);
  assert.match(rankingScreen, /Ranking começando/);
  assert.match(rankingScreen, /Não foi possível carregar/);
  assert.match(settingsScreen, /updateRankingOptIn/);
  assert.match(settingsScreen, /Participar do ranking público/);
  assert.doesNotMatch(rankingScreen + rankingData, /Ana Tavares|stablePackFactor|Prévia local|dados demonstrativos/);
});

test('Ranking aparece no drawer e a rota antiga redireciona', () => {
  const registeredRoutes = Array.from(tabsLayout.matchAll(/name="(inicio|questoes|concursos|simulados|explorar)"/g), match => match[1]);
  assert.deepEqual(registeredRoutes, ['inicio', 'questoes', 'concursos', 'simulados', 'explorar']);
  assert.doesNotMatch(tabsLayout, /\bTabs\b|tabBar/);
  assert.match(tabsLayout, /name="rank"/);
  assert.match(rankTab, /<Redirect href=\{APP_ROUTE_ALIASES\.rank\}/);
});

test('a barra inferior é a única navegação primária visível', () => {
  assert.match(tabsLayout, /<Drawer/);
  assert.match(tabsLayout, /<KadBottomNavigation \/>/);
  assert.match(tabsLayout, /drawerContent=\{\(\) => null\}/);
  assert.doesNotMatch(tabsLayout, /KadDrawerContent/);
  assert.doesNotMatch(tabsLayout, /tabBar|bottom-tabs/);
});
