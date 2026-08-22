import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import {
  MOTION_DURATION,
  MOTION_EASING,
  MOTION_OPACITY,
  MOTION_SCALE,
  resolvePressFeedback,
} from '../constants/motion.ts';
import {
  createHapticFeedbackController,
  HAPTIC_ACTIONS,
  type HapticFeedbackAdapter,
} from '../lib/haptic-feedback.ts';

const home = readFileSync(new NodeURL('../app/(tabs)/inicio.tsx', import.meta.url), 'utf8');
const hapticTab = readFileSync(
  new NodeURL('../components/haptic-tab.tsx', import.meta.url),
  'utf8'
);
const pressFeedback = readFileSync(
  new NodeURL('../components/ui/press-feedback.tsx', import.meta.url),
  'utf8'
);
const segmented = readFileSync(
  new NodeURL('../components/ui/segmented.tsx', import.meta.url),
  'utf8'
);
const hapticsAdapter = readFileSync(new NodeURL('../lib/haptics.ts', import.meta.url), 'utf8');

function createAdapterSpy() {
  const calls: string[] = [];
  const adapter: HapticFeedbackAdapter = {
    impact: async (style) => {
      calls.push(`impact:${style}`);
    },
    notification: async (type) => {
      calls.push(`notification:${type}`);
    },
    selection: async () => {
      calls.push('selection');
    },
  };

  return { adapter, calls };
}

test('tokens de toque mantêm escala e duração dentro do contrato aprovado', () => {
  assert.equal(MOTION_SCALE.pressed, 0.98);
  assert.equal(MOTION_OPACITY.pressed, 0.94);
  assert.deepEqual(MOTION_EASING.standard, [0.2, 0, 0, 1]);
  assert.ok(MOTION_DURATION.pressIn >= 100 && MOTION_DURATION.pressIn <= 150);
  assert.ok(MOTION_DURATION.pressOut >= 100 && MOTION_DURATION.pressOut <= 150);
});

test('redução de movimento preserva o feedback sem deslocamento animado', () => {
  assert.deepEqual(resolvePressFeedback(true, true), {
    duration: 0,
    opacity: MOTION_OPACITY.pressed,
    scale: 1,
  });
  assert.deepEqual(resolvePressFeedback(false, true), {
    duration: 0,
    opacity: MOTION_OPACITY.rest,
    scale: 1,
  });
});

test('feedback tátil é operação vazia no web', async () => {
  const { adapter, calls } = createAdapterSpy();
  const controller = createHapticFeedbackController({ adapter, platform: 'web' });

  assert.equal(await controller.trigger('confirm-answer'), false);
  assert.deepEqual(calls, []);
});

test('feedback tátil aceita somente ações importantes e usa padrões discretos', async () => {
  const { adapter, calls } = createAdapterSpy();
  const controller = createHapticFeedbackController({ adapter, platform: 'native' });

  assert.deepEqual(HAPTIC_ACTIONS, [
    'confirm-answer',
    'toggle-favorite',
    'complete-goal',
    'finish-simulation',
  ]);
  assert.equal(await controller.trigger('open-shortcut'), false);
  assert.equal(await controller.trigger('confirm-answer'), true);
  assert.equal(await controller.trigger('toggle-favorite'), true);
  assert.equal(await controller.trigger('complete-goal'), true);
  assert.equal(await controller.trigger('finish-simulation'), true);
  assert.deepEqual(calls, [
    'impact:medium',
    'selection',
    'notification:success',
    'notification:success',
  ]);
});

test('a ação principal e os três atalhos da tela Início usam a resposta reutilizável', () => {
  assert.match(home, /<FeaturedCard[\s\S]*?motionFeedback/);
  assert.match(home, /PRACTICE_ACTIONS\.map\([\s\S]*?<PressFeedback/);
  assert.doesNotMatch(home, /triggerHaptic/);
});

test('somente o adaptador central acessa expo-haptics', () => {
  assert.match(hapticsAdapter, /from 'expo-haptics'/);
  assert.doesNotMatch(hapticTab, /expo-haptics|Haptics\./);
  assert.doesNotMatch(segmented, /expo-haptics|Haptics\./);
});

test('a resposta ao toque anima o próprio Pressable e preserva seu contrato de layout', () => {
  assert.match(pressFeedback, /Animated\.createAnimatedComponent\(Pressable\)/);
  assert.doesNotMatch(pressFeedback, /<Animated\.View/);
});
