import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

const source = (path: string) => readFileSync(new NodeURL(path, import.meta.url), 'utf8');

const featuredCard = source('../components/ui/featured-card.tsx');
const artwork = source('../components/ui/kad-card-artwork.tsx');
const drawerLayout = source('../app/(tabs)/_layout.tsx');
const button = source('../components/ui/button.tsx');
const topicPlayer = source('../app/questoes/[discipline]/[topic].tsx');
const segmented = source('../components/ui/segmented.tsx');
const animatedCounter = source('../components/ui/animated-counter.tsx');

test('arte do destaque móvel fica contida em sua coluna', () => {
  assert.match(featuredCard, /width >= 420 && fontScale < 1\.75/);
  assert.match(featuredCard, /artwork:\s*\{[\s\S]*?overflow: 'hidden'/);
  assert.match(artwork, /root:\s*\{[\s\S]*?overflow: 'hidden'/);
});

test('drawer não declara rota raiz de flashcards como filha das tabs', () => {
  assert.doesNotMatch(drawerLayout, /<Drawer\.Screen name="flashcards"/);
});

test('botão desabilitado usa tokens legíveis em vez de reduzir opacidade', () => {
  assert.match(button, /disabled[\s\S]*?background: colors\.surfaceSunken/);
  assert.match(button, /foreground: colors\.textMuted/);
  assert.doesNotMatch(button, /opacity: disabled \? 0\.45/);
});

test('player só mostra ações de rodapé quando elas podem ser usadas', () => {
  assert.match(topicPlayer, /const showPreviousAction = !isFirst/);
  assert.match(topicPlayer, /const showForwardAction = hasAnsweredCurrent/);
  assert.match(topicPlayer, /\{showFooter \? \(/);
  assert.doesNotMatch(topicPlayer, /disabled=\{!answers\[current\.id\]\}/);
});

test('controle segmentado evita animação nativa e sombra iOS no web', () => {
  assert.match(segmented, /useNativeDriver: Platform\.OS !== 'web'/);
  assert.match(segmented, /\.\.\.Platform\.select\(/);
});

test('contador decorativo usa a propriedade visual compatível com web', () => {
  assert.doesNotMatch(animatedCounter, /pointerEvents="none"/);
  assert.match(animatedCounter, /pointerEvents: 'none'/);
});
