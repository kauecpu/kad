import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import { ONBOARDING_START_OPTIONS } from '../lib/onboarding-destinations.ts';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const onboardingScreen = source('../app/onboarding.tsx');
const mascot = source('../components/kad-mascot.tsx');

test('o onboarding preserva quatro etapas com textos mais diretos', () => {
  assert.match(onboardingScreen, /id: 'welcome'/);
  assert.match(onboardingScreen, /id: 'questions'/);
  assert.match(onboardingScreen, /id: 'simulations'/);
  assert.match(onboardingScreen, /id: 'start'/);
  assert.match(onboardingScreen, /Tudo para sua preparação/);
  assert.match(onboardingScreen, /Por onde você quer começar\?/);
  assert.doesNotMatch(onboardingScreen, /Seu estudo, com direção/);
});

test('a escolha inicial oferece as quatro rotas previstas', () => {
  assert.deepEqual(
    ONBOARDING_START_OPTIONS.map(({ label, route }) => ({ label, route })),
    [
      { label: 'Encontrar um concurso', route: '/concursos' },
      { label: 'Resolver questões', route: '/questoes' },
      { label: 'Fazer um simulado', route: '/simulados' },
      { label: 'Explorar o KAD', route: '/inicio' },
    ]
  );
  assert.equal(new Set(ONBOARDING_START_OPTIONS.map(({ route }) => route)).size, 4);
});

test('conclusão bloqueia toques repetidos e navega apenas depois da persistência', () => {
  assert.match(onboardingScreen, /navigationLockedRef\.current/);
  assert.match(onboardingScreen, /await markOnboardingComplete\(session\.user\.id\)/);
  assert.match(onboardingScreen, /router\.replace\(destination\)/);
  assert.ok(
    onboardingScreen.indexOf('await markOnboardingComplete(session.user.id)') <
      onboardingScreen.indexOf('router.replace(destination)')
  );
  assert.match(onboardingScreen, /disabled=\{finishing\}/);
  assert.match(onboardingScreen, /ActivityIndicator/);
});

test('prévia não persiste o onboarding e pular leva ao início', () => {
  assert.match(onboardingScreen, /if \(!isPreview && session\)/);
  assert.match(onboardingScreen, /finishOnboarding\('\/inicio'\)/);
  assert.match(onboardingScreen, /accessibilityLabel="Pular apresentação"/);
});

test('conteúdo suporta rolagem vertical e o mascote respeita movimento reduzido', () => {
  assert.match(onboardingScreen, /<ScrollView/);
  assert.match(onboardingScreen, /contentContainerStyle/);
  assert.match(mascot, /useReducedMotion\(\)/);
  assert.match(mascot, /if \(!active \|\| reduceMotion\)/);
});

test('a marca mantém o wordmark legível no tema escuro', () => {
  assert.match(onboardingScreen, /const \{ colors, isDark \} = useTheme\(\)/);
  assert.match(onboardingScreen, /isDark \? \(/);
  assert.match(onboardingScreen, /styles\.darkWordmark/);
  assert.match(onboardingScreen, /tintColor=\{colors\.text\}/);
});
