import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const gallery = source('../components/achievement-gallery.tsx');
const feedback = source('../components/gamification-feedback.tsx');
const nextAchievement = source('../components/next-achievement-card.tsx');
const ranking = source('../app/(tabs)/ranking.tsx');
const settings = source('../app/(tabs)/configuracoes.tsx');

test('galeria oferece filtros, progresso numérico e rótulos acessíveis', () => {
  assert.match(gallery, /ACHIEVEMENT_CATEGORIES\.map/);
  assert.match(gallery, /item\.value\.toLocaleString/);
  assert.match(gallery, /accessibilityLabel=/);
  assert.match(gallery, /ProgressBar/);
  assert.match(gallery, /Desbloqueada em/);
});

test('feedback respeita movimento reduzido e não bloqueia o estudo', () => {
  assert.match(feedback, /useReducedMotion/);
  assert.match(feedback, /animationType=\{reduceMotion \? 'none' : 'fade'\}/);
  assert.match(feedback, /pointerEvents="none"/);
  assert.match(feedback, /accessibilityLiveRegion="polite"/);
  assert.match(feedback, /consumeNotice\(next\.id\)/);
});

test('início mostra próxima conquista como ação acessível', () => {
  assert.match(nextAchievement, /nextLockedAchievement/);
  assert.match(nextAchievement, /accessibilityRole="button"/);
  assert.match(nextAchievement, /Próxima conquista/);
  assert.match(nextAchievement, /ProgressBar/);
});

test('ranking possui carregamento, vazio, erro e leva a privacidade para configurações', () => {
  assert.match(ranking, /accessibilityRole="progressbar"/);
  assert.match(ranking, /Ranking começando/);
  assert.match(ranking, /Não foi possível carregar/);
  assert.match(ranking, /Privacidade do ranking/);
  assert.match(ranking, /router\.push\('\/configuracoes'\)/);
  assert.match(settings, /Participar do ranking público/);
});
