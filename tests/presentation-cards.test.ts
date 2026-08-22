import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const simulations = source('../app/(tabs)/simulados.tsx');
const profile = source('../app/(tabs)/perfil.tsx');
const questions = source('../app/(tabs)/questoes.tsx');
const home = source('../app/(tabs)/inicio.tsx');
const concursos = source('../app/(tabs)/concursos.tsx');
const ranking = source('../app/ranking.tsx');
const trails = source('../app/trilhas.tsx');
const essays = source('../app/redacao.tsx');
const featuredCard = source('../components/ui/featured-card.tsx');

test('o card de destaque define uma assinatura visual compartilhada e adaptativa', () => {
  assert.match(featuredCard, /export function FeaturedCard/);
  assert.match(featuredCard, /colors=\{\[soft, colors\.surface, colors\.surface\]\}/);
  assert.match(featuredCard, /styles\.facetThin/);
  assert.match(featuredCard, /styles\.iconGleam/);
  assert.match(featuredCard, /accessibilityState=\{\{ disabled \}\}/);
  assert.match(featuredCard, /tone === 'achievement'/);
});

test('a intensidade forte é opcional e preserva o card padrão', () => {
  assert.match(featuredCard, /intensity\?: 'standard' \| 'strong'/);
  assert.match(featuredCard, /artwork\?: ReactNode/);
  assert.match(featuredCard, /intensity = 'standard'/);
  assert.match(featuredCard, /<KadProgressSignature/);
  assert.match(featuredCard, /colors\.brandSurfaceDeep/);
  assert.match(featuredCard, /colors\.brandSurfaceStrong/);
  assert.match(featuredCard, /\[soft, colors\.surface, colors\.surface\]/);
});

test('o card de montar simulado mantém estados e CTA dentro da nova superfície', () => {
  assert.match(simulations, /<FeaturedCard/);
  assert.match(simulations, /PROVA PERSONALIZADA/);
  assert.match(simulations, /Verificando seu plano para montar simulados/);
  assert.match(simulations, /Conhecer planos com simulados personalizados/);
  assert.match(simulations, /canUseSimulations[\s\S]*?Configurar prova[\s\S]*?Conhecer planos/);
});

test('o cartão de identidade preserva perfil, plano e ação acessível', () => {
  assert.match(profile, /IDENTIDADE KAD/);
  assert.match(profile, /IDENTITY_COLORS/);
  assert.match(profile, /styles\.identityBrandGlow/);
  assert.match(profile, /styles\.identityRail/);
  assert.match(profile, /styles\.identityAvatarRing/);
  assert.match(profile, /styles\.identityStorageNote/);
  assert.match(profile, /Sua preparação fica salva só aqui/);
  assert.match(profile, /styles\.primaryActionGradient/);
  assert.match(profile, /accessibilityLabel=\{primaryAction\.label\}/);
  assert.match(profile, /accessibilityHint=\{primaryAction\.description\}/);
  assert.match(profile, /subscription\.plan === 'diamond'/);
});

test('o explorador de questões reúne modo e busca em um card acessível', () => {
  assert.match(questions, /<FeaturedCard/);
  assert.match(questions, /EXPLORAR QUESTÕES/);
  assert.match(questions, /Escolha como estudar/);
  assert.match(questions, /<Segmented options=\{STUDY_OPTIONS\}/);
  assert.match(questions, /accessibilityLabel="Procurar questões"/);
  assert.match(questions, /styles\.filterIcon/);
});

test('os demais destaques usam a mesma família sem substituir o cartão de perfil', () => {
  assert.match(home, /<FeaturedCard[\s\S]*?eyebrow=\{primaryAction\.eyebrow\}/);
  assert.match(concursos, /<FeaturedCard[\s\S]*?eyebrow="FOCO DA META"/);
  assert.match(ranking, /<FeaturedCard[\s\S]*?tone="achievement"/);
  assert.match(trails, /<FeaturedCard[\s\S]*?heroTrack\?\.name/);
  assert.match(essays, /<FeaturedCard[\s\S]*?Badge label="Recomendado"/);
  assert.doesNotMatch(profile, /FeaturedCard/);
});

test('a Redação mantém um destaque mesmo quando o perfil ainda não possui meta', () => {
  assert.match(essays, /!recommendedTopic && !hasActiveDiscovery/);
  assert.match(essays, /eyebrow="PRÁTICA DE REDAÇÃO"/);
  assert.match(essays, /Sua próxima redação começa aqui/);
  assert.match(essays, /Prática guiada/);
  assert.match(essays, /recommendedTopic && !hasActiveDiscovery[\s\S]*?Para sua meta/);
});
