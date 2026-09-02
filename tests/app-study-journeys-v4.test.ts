import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const home = source('../app/(tabs)/inicio.tsx');
const questions = source('../app/(tabs)/questoes.tsx');
const simulations = source('../app/(tabs)/simulados.tsx');
const trails = source('../app/(tabs)/trilhas.tsx');

test('a Início contextualiza a ação principal e usa um verbo específico para cada jornada', () => {
  assert.match(home, /label=\{primaryAction\.eyebrow\}/);
  assert.match(home, /actionLabel=\{primaryActionLabel\}/);
  for (const label of [
    'Definir minha meta',
    'Revisar erros',
    'Começar desafio',
    'Continuar simulado',
    'Ver resultado',
  ]) {
    assert.match(home, new RegExp(label));
  }
});

test('Questões oferece três entradas reais sem repetir um card promocional', () => {
  const tools = questions.indexOf('styles.studyTools');
  const segmented = questions.indexOf('<Segmented options={STUDY_OPTIONS}');
  const search = questions.indexOf('Buscar questões no banco');
  const challenge = questions.indexOf('Começar desafio rápido de três questões');
  const list = questions.indexOf('studyItems.length');

  assert.ok(tools >= 0);
  assert.ok(segmented > tools);
  assert.ok(search > segmented);
  assert.ok(challenge > search);
  assert.ok(list > challenge);
  assert.doesNotMatch(questions, /<FeaturedCard|intensity="strong"/);
});

test('Simulados prioriza retomada e mantém a configuração como ação única da bancada', () => {
  const resume = simulations.indexOf('session ?');
  const builder = simulations.indexOf('styles.builderCard');
  const recommendation = simulations.indexOf('recommendedPack ?');

  assert.ok(resume >= 0);
  assert.ok(builder > resume);
  assert.ok(recommendation > builder);
  assert.match(simulations, /fullWidth/);
  assert.doesNotMatch(simulations, /<FeaturedCard|visual="faceted"/);
});

test('Trilhas atualiza o resumo para a escolha atual e não repete métricas em outro card', () => {
  assert.match(trails, /const heroTrack = track \?\? recommendedTrack/);
  assert.match(trails, /styles\.journeyLead/);
  assert.match(trails, /Badge label="Recomendada" tone="energy"/);
  assert.doesNotMatch(trails, /currentMetrics|trackSummary|summaryMetrics/);
  assert.doesNotMatch(trails, /<FeaturedCard|KadCardArtwork/);
});

test('as três jornadas preservam ações e rótulos acessíveis', () => {
  assert.match(questions, /accessibilityLabel="Buscar questões no banco"/);
  assert.match(questions, /accessibilityLabel="Começar desafio rápido de três questões"/);
  assert.match(simulations, /disabled=\{subscriptionLoading\}/);
  assert.match(trails, /accessibilityLabel=\{`Nível \$\{level\.number\}/);
});
