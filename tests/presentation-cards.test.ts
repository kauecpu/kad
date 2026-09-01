import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const simulations = source('../app/(tabs)/simulados.tsx');
const profile = source('../app/perfil/index.tsx');
const questions = source('../app/(tabs)/questoes.tsx');
const home = source('../app/(tabs)/inicio.tsx');
const concursos = source('../app/(tabs)/concursos.tsx');
const ranking = source('../app/ranking.tsx');
const trails = source('../app/trilhas.tsx');
const essays = source('../app/redacao.tsx');
const featuredCard = source('../components/ui/featured-card.tsx');
const cardArtwork = source('../components/ui/kad-card-artwork.tsx');
const concursoCard = source('../components/concurso-card.tsx');

test('o destaque compartilhado oferece superfície sólida e visual facetado opcional', () => {
  assert.match(featuredCard, /export function FeaturedCard/);
  assert.match(featuredCard, /backgroundColor: colors\.surfaceAlt/);
  assert.match(featuredCard, /backgroundColor: colors\.brandSurfaceStrong/);
  assert.match(featuredCard, /type FeaturedCardVisual = 'plain' \| 'faceted'/);
  assert.match(featuredCard, /LinearGradient/);
  assert.match(featuredCard, /minHeight: 44/);
  assert.match(featuredCard, /accessibilityState=\{\{ disabled \}\}/);
  assert.match(featuredCard, /tone === 'achievement'/);
});

test('a intensidade forte e a arte facetada são opt-in', () => {
  assert.match(featuredCard, /intensity\?: 'standard' \| 'strong'/);
  assert.match(featuredCard, /artwork\?: ReactNode/);
  assert.match(featuredCard, /intensity = 'standard'/);
  assert.match(featuredCard, /colors\.brandSurfaceStrong/);
  assert.match(featuredCard, /colors\.brandSurfaceDeep/);
  assert.match(featuredCard, /styles\.frameStrong/);
  assert.doesNotMatch(featuredCard, /cardShadow/);
});

test('a arte facetada usa tokens e permanece decorativa', () => {
  assert.match(cardArtwork, /LinearGradient/);
  assert.match(cardArtwork, /colors\.primary/);
  assert.match(cardArtwork, /colors\.brandSurfaceDeep/);
  assert.match(cardArtwork, /pointerEvents: 'none'/);
  assert.match(cardArtwork, /accessibilityElementsHidden/);
  assert.doesNotMatch(cardArtwork, /#[0-9A-Fa-f]{6}/);
});

test('o card de montar simulado mantém estados e CTA dentro da nova superfície', () => {
  assert.match(simulations, /<FeaturedCard/);
  assert.match(simulations, /Verificando seu plano para montar simulados/);
  assert.match(simulations, /Conhecer planos com simulados personalizados/);
  assert.match(simulations, /canUseSimulations[\s\S]*?Configurar prova[\s\S]*?Conhecer planos/);
});

test('o perfil preserva conta e plano sem a decoração do antigo dossiê', () => {
  assert.match(profile, /Conta, plano e preferências/);
  assert.match(profile, /styles\.identityHeader/);
  assert.match(profile, /styles\.identityAvatar/);
  assert.match(profile, /styles\.identityStorageNote/);
  assert.match(profile, /Sua preparação fica salva só aqui/);
  assert.match(profile, /backgroundColor: colors\.primary/);
  assert.match(profile, /accessibilityLabel=\{primaryAction\.label\}/);
  assert.match(profile, /accessibilityHint=\{primaryAction\.description\}/);
  assert.match(profile, /subscription\.plan === 'diamond'/);
  assert.doesNotMatch(
    profile,
    /LinearGradient|IDENTIDADE KAD|identityBrandGlow|identityRail|primaryActionGradient|Dossiê do candidato/
  );
  assert.doesNotMatch(profile, /<DossierSection index=/);
});

test('o explorador de questões reúne modo e busca em um card acessível', () => {
  assert.match(questions, /<FeaturedCard/);
  assert.match(questions, /Escolha como estudar/);
  assert.match(questions, /<Segmented options=\{STUDY_OPTIONS\}/);
  assert.match(questions, /accessibilityLabel="Procurar questões"/);
  assert.doesNotMatch(questions, /styles\.filterIcon/);
  assert.match(questions, /styles\.itemSeparator/);
  assert.doesNotMatch(questions, /<Card/);
});

test('os demais destaques usam a mesma família sem substituir o cartão de perfil', () => {
  assert.match(
    home,
    /<FeaturedCard[\s\S]*?intensity="strong"[\s\S]*?title=\{primaryAction\.title\}/
  );
  assert.match(concursos, /<FeaturedCard[\s\S]*?title=\{targetRole\}/);
  assert.match(ranking, /<FeaturedCard[\s\S]*?tone="achievement"/);
  assert.match(trails, /<FeaturedCard[\s\S]*?heroTrack\?\.name/);
  assert.match(essays, /<FeaturedCard[\s\S]*?Badge label="Recomendado"/);
  assert.doesNotMatch(profile, /FeaturedCard/);
});

test('o destaque principal usa a assinatura facetada em cada jornada', () => {
  for (const screen of [home, questions, concursos, simulations, trails, essays]) {
    assert.match(screen, /visual="faceted"/);
    assert.match(screen, /artwork=\{<KadCardArtwork variant="/);
  }
  assert.match(ranking, /tone="achievement"/);
  assert.doesNotMatch(ranking, /visual="faceted"/);
});

test('a Redação mantém um destaque mesmo quando o perfil ainda não possui meta', () => {
  assert.match(essays, /!recommendedTopic && !hasActiveDiscovery/);
  assert.match(essays, /Sua próxima redação começa aqui/);
  assert.match(essays, /Prática guiada/);
  assert.match(essays, /recommendedTopic && !hasActiveDiscovery[\s\S]*?Para sua meta/);
});

test('os destaques não reintroduzem kickers genéricos nas jornadas', () => {
  for (const screen of [simulations, questions, home, concursos, ranking, trails, essays]) {
    assert.doesNotMatch(screen, /<FeaturedCard[\s\S]*?eyebrow=/);
  }
});

test('o radar de editais mantém os dados e remove ornamentos de template', () => {
  assert.doesNotMatch(concursos, /KAD \/ CONCURSOS|eyebrowRail|Fonts\.mono/);
  assert.doesNotMatch(concursoCard, /accentRail|accentSlash|Fonts\.mono|K\/\$\{marker\}/);
  assert.match(concursoCard, /concurso\.title/);
  assert.match(concursoCard, /REMUNERAÇÃO/);
  assert.match(concursoCard, /VAGAS/);
  assert.match(concursoCard, /deadline\.label/);
});

