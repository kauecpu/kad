import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

const home = readFileSync(new NodeURL('../app/(tabs)/inicio.tsx', import.meta.url), 'utf8');
const section = readFileSync(new NodeURL('../components/ui/section.tsx', import.meta.url), 'utf8');

test('a tela inicial mantém uma única ação principal antes dos atalhos', () => {
  assert.equal(home.match(/<FeaturedCard/g)?.length, 1);

  const primaryAction = home.indexOf('<FeaturedCard');
  const summary = home.indexOf('accessibilityLabel="Resumo da preparação"');
  const shortcuts = home.indexOf('title="Praticar agora"');

  assert.ok(primaryAction >= 0);
  assert.ok(summary > primaryAction);
  assert.ok(shortcuts > summary);
});

test('a ação principal preserva jornada e marca sem o mascote', () => {
  assert.match(home, /getHomePrimaryVisual\(primaryAction\)/);
  assert.match(home, /intensity="strong"/);
  assert.match(home, /tone=\{primaryVisual\.tone\}/);
  assert.doesNotMatch(home, /KadMascot|primaryVisual\.mascot|artwork=/);
  assert.match(home, /color=\{colors\.onBrand\}/);
  assert.match(home, /trackColor=\{colors\.brandTrace\}/);
  assert.equal(home.match(/<FeaturedCard/g)?.length, 1);
});

test('o resumo compacto mostra atividade de hoje e meta semanal reais', () => {
  assert.match(home, /\{dailyQuestionsAnswered\}/);
  assert.match(home, /\{studyMomentum\.weeklyQuestions\} de \{studyMomentum\.weeklyGoal\}/);
  assert.match(home, /label=\{`Meta semanal: \$\{studyMomentum\.weeklyQuestions\} de \$\{studyMomentum\.weeklyGoal\} questões`\}/);
});

test('praticar agora oferece somente os três atalhos essenciais com ícones vetoriais', () => {
  assert.match(home, /title="Praticar agora"/);
  assert.match(home, /actionLabel="Ver tudo"/);
  assert.match(home, /title: 'Questões',[\s\S]*?icon: 'reader-outline'/);
  assert.match(home, /title: 'Simulados',[\s\S]*?icon: 'timer-outline'/);
  assert.match(home, /title: 'Trilhas',[\s\S]*?icon: 'map-outline'/);
  assert.match(home, /accessibilityElementsHidden/);
  assert.match(home, /aria-hidden=\{true\}/);
});

test('as seções permanecem abaixo do título principal na hierarquia semântica', () => {
  assert.match(section, /accessibilityRole="header"/);
  assert.match(section, /aria-level=\{2\}/);
});
