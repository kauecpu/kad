import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

const source = (path: string) => readFileSync(new NodeURL(path, import.meta.url), 'utf8');
const home = source('../app/(tabs)/inicio.tsx');
const section = source('../components/ui/section.tsx');
const featureCatalog = source('../lib/app-feature-catalog.ts');
const explore = source('../app/(tabs)/explorar.tsx');

test('a tela inicial mantém uma única ação principal e a hierarquia do painel diário', () => {
  assert.equal(home.match(/<FeaturedCard/g)?.length, 1);

  const primaryAction = home.indexOf('<FeaturedCard');
  const summary = home.indexOf('accessibilityLabel="Resumo da preparação"');
  const momentum = home.indexOf('title="Seu ritmo"');
  const recent = home.indexOf('title="Atividade recente"');
  const deadline = home.indexOf('title="Prazo da sua meta"');

  assert.ok(primaryAction >= 0);
  assert.ok(summary > primaryAction);
  assert.ok(momentum > summary);
  assert.ok(recent > momentum);
  assert.ok(deadline > recent);
});

test('a ação principal preserva jornada e usa a assinatura facetada', () => {
  assert.match(home, /getHomePrimaryVisual\(primaryAction\)/);
  assert.match(home, /intensity="strong"/);
  assert.match(home, /tone=\{primaryVisual\.tone\}/);
  assert.match(home, /visual="faceted"/);
  assert.match(home, /KadCardArtwork/);
  assert.match(home, /color=\{colors\.onBrand\}/);
  assert.match(home, /trackColor=\{colors\.brandTrace\}/);
});

test('o resumo mostra valores reais, restante semanal e adaptação à fonte', () => {
  assert.match(home, /\{dailyQuestionsAnswered\}/);
  assert.match(home, /\{studyMomentum\.weeklyQuestions\} de \{studyMomentum\.weeklyGoal\}/);
  assert.match(home, /weeklyRemaining/);
  assert.match(home, /faltam \$\{weeklyRemaining\}/);
  assert.match(home, /fontScale >= 1\.3/);
  assert.match(home, /styles\.summaryStripStacked/);
  assert.doesNotMatch(home, /styles\.summaryCard|styles\.summaryIcon/);
});

test('a home não duplica o catálogo de funções disponível em Explorar e no drawer', () => {
  assert.doesNotMatch(home, /PRACTICE_ACTIONS|EXPLORE_ACTIONS/);
  assert.doesNotMatch(home, /title="Praticar agora"|title="Explorar"|title="Minha meta"/);
  assert.doesNotMatch(home, /route: '\/(redacao|biblioteca|trilhas|simulados)'/);
  assert.match(explore, /APP_FEATURE_GROUPS/);
  assert.match(featureCatalog, /title: 'Questões'/);
  assert.match(featureCatalog, /title: 'Concursos'/);
  assert.match(featureCatalog, /title: 'Simulados'/);
  assert.match(featureCatalog, /title: 'Trilhas'/);
  assert.match(featureCatalog, /title: 'Redação'/);
  assert.match(featureCatalog, /title: 'Biblioteca'/);
  assert.match(featureCatalog, /APP_DRAWER_ITEMS/);
});

test('o histórico limita a duas atividades e o vazio leva ao desafio diário', () => {
  assert.match(home, /recentLimit: 2/);
  assert.match(home, /onStart=\{\(\) => router\.push\('\/questoes\/desafio'\)\}/);
});

test('o prazo é compacto e só aparece com inscrição aberta e data real', () => {
  assert.match(home, /focusConcurso\?\.status === 'aberto' && focusConcurso\.registrationEnd/);
  assert.match(home, /focusDeadlineCandidate\?\.tone !== 'neutral'/);
  assert.match(home, /styles\.deadlineAlert/);
  assert.doesNotMatch(home, /goalCard|roleCard|formatSalaryShort|<Badge/);
});

test('as seções permanecem abaixo do título principal na hierarquia semântica', () => {
  assert.match(section, /accessibilityRole="header"/);
  assert.match(section, /aria-level=\{2\}/);
});

