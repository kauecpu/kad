import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import {
  MOTION_DURATION,
  resolveMotionDuration,
  resolveStackAnimation,
  resolveProgressFill,
  shouldUnmountModal,
} from '../constants/motion.ts';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const rootLayout = source('../app/_layout.tsx');
const progressBar = source('../components/ui/progress-bar.tsx');
const animatedCounter = source('../components/ui/animated-counter.tsx');
const statCard = source('../components/ui/stat-card.tsx');
const simulationResult = source('../app/questoes/simulado/resultado.tsx');
const performance = source('../app/perfil/desempenho.tsx');
const modalMotion = source('../hooks/use-modal-transition.ts');
const modalSheets = [
  source('../components/concurso-filter-sheet.tsx'),
  source('../components/question-filter-sheet.tsx'),
  source('../components/ui/multi-select-sheet.tsx'),
];

test('tokens de navegação, modal, progresso e contador ficam entre 200 e 300 ms', () => {
  for (const duration of [
    MOTION_DURATION.navigation,
    MOTION_DURATION.modal,
    MOTION_DURATION.progress,
    MOTION_DURATION.counter,
  ]) {
    assert.ok(duration >= 200 && duration <= 300);
  }
});

test('redução de movimento leva transições diretamente ao estado final', () => {
  assert.equal(resolveMotionDuration('navigation', true), 0);
  assert.equal(resolveMotionDuration('modal', true), 0);
  assert.equal(resolveMotionDuration('progress', true), 0);
  assert.equal(resolveMotionDuration('counter', true), 0);
  assert.equal(resolveMotionDuration('progress', false), MOTION_DURATION.progress);
});

test('cada plataforma usa uma navegação suportada dentro do contrato', () => {
  assert.equal(resolveStackAnimation('ios', false), 'simple_push');
  assert.equal(resolveStackAnimation('android', false), 'ios_from_right');
  assert.equal(resolveStackAnimation('web', false), 'none');
  assert.equal(resolveStackAnimation('android', true), 'none');
});

test('progresso preserva o valor real e apenas garante visibilidade ao preenchimento', () => {
  assert.deepEqual(resolveProgressFill(-20), { value: 0, fill: 0 });
  assert.deepEqual(resolveProgressFill(1), { value: 1, fill: 5 });
  assert.deepEqual(resolveProgressFill(72.4), { value: 72.4, fill: 72.4 });
  assert.deepEqual(resolveProgressFill(140), { value: 100, fill: 100 });
});

test('navegação usa direção nativa e redução de movimento sem bloquear ações', () => {
  assert.match(rootLayout, /animation:\s*resolveStackAnimation\(Platform\.OS, reduceMotion\)/);
  assert.match(rootLayout, /animationDuration:\s*resolveMotionDuration\('navigation', reduceMotion\)/);
  assert.match(rootLayout, /freezeOnBlur:\s*Platform\.OS !== 'web'/);
  assert.doesNotMatch(rootLayout, /setTimeout|await\s+.*animation|runOnJS/);
});

test('barras iniciam no valor final e animam somente alterações posteriores', () => {
  assert.match(progressBar, /useSharedValue\(fill\)/);
  assert.match(progressBar, /if \(!didMount\.current\)/);
  assert.match(progressBar, /withTiming\(fill/);
  assert.match(progressBar, /transform:\s*\[\{ scaleX: animatedFill\.value \/ 100 \}\]/);
  assert.match(progressBar, /transformOrigin: 'left center'/);
  assert.match(
    progressBar,
    /accessibilityValue=\{\{ min: 0, max: 100, now: Math\.round\(clampedValue\) \}\}/
  );
});

test('contadores preservam o número real para acessibilidade e não animam na montagem', () => {
  assert.match(animatedCounter, /<Text[\s\S]*?accessibilityLabel=\{accessibilityLabel \?\? formattedValue\}/);
  assert.match(animatedCounter, /styles\.accessibleValue/);
  assert.match(animatedCounter, /<AnimatedTextInput[\s\S]*?accessibilityElementsHidden/);
  assert.match(animatedCounter, /useSharedValue\(value\)/);
  assert.match(animatedCounter, /if \(!didMount\.current\)/);
  assert.match(animatedCounter, /withTiming\(value/);
});

test('pontuação e desempenho usam o contador reutilizável sem mudar os dados', () => {
  assert.match(statCard, /AnimatedCounter/);
  assert.match(simulationResult, /<AnimatedCounter[\s\S]*?value=\{Math\.round\(score\.accuracy\)\}/);
  assert.match(performance, /animatedValue=\{performance\.total\}/);
  assert.match(performance, /animatedValue=\{performance\.correct\}/);
  assert.match(performance, /animatedValue=\{performance\.wrong\}/);
});

test('modais compartilham uma transição cancelável e não atrasam onClose', () => {
  assert.match(modalMotion, /cancelAnimation\(progress\)/);
  assert.match(modalMotion, /transitionGeneration\.current/);
  assert.match(modalMotion, /visibleRef\.current/);
  assert.match(modalMotion, /runOnJS\(finishClose\)\(generation\)/);
  assert.match(modalMotion, /withTiming\(\s*0/);
  for (const sheet of modalSheets) {
    assert.match(sheet, /useModalTransition\(visible\)/);
    assert.match(sheet, /visible=\{mounted\}/);
    assert.match(sheet, /animationType="none"/);
    assert.doesNotMatch(sheet, /setTimeout|await\s+onClose/);
  }
});

test('reabrir durante a saída invalida o callback antigo de desmontagem', () => {
  assert.equal(shouldUnmountModal(2, 2, false), true);
  assert.equal(shouldUnmountModal(2, 3, false), false);
  assert.equal(shouldUnmountModal(2, 2, true), false);
});
