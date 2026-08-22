/** Tokens compartilhados para movimentos curtos e previsíveis no KAD. */
export const MINIMUM_TOUCH_TARGET = 44;

export const MOTION_DURATION = {
  pressIn: 110,
  pressOut: 140,
  navigation: 250,
  modal: 240,
  progress: 240,
  counter: 260,
  selection: 180,
  reaction: 180,
  expand: 220,
  icon: 140,
} as const;

export const MOTION_SCALE = {
  rest: 1,
  pressed: 0.98,
} as const;

export const MOTION_OPACITY = {
  rest: 1,
  pressed: 0.94,
} as const;

/** Curva de desaceleração curta: responde rápido e termina sem salto visual. */
export const MOTION_EASING = {
  standard: [0.2, 0, 0, 1],
} as const;

export type PressFeedbackState = {
  duration: number;
  opacity: number;
  scale: number;
};

export type MotionTransition =
  | 'navigation'
  | 'modal'
  | 'progress'
  | 'counter'
  | 'selection'
  | 'reaction'
  | 'expand'
  | 'icon';
export type StackMotionAnimation = 'none' | 'simple_push' | 'ios_from_right';

export function resolveMotionDuration(
  transition: MotionTransition,
  reduceMotion: boolean
) {
  return reduceMotion ? 0 : MOTION_DURATION[transition];
}

export function resolveStackAnimation(
  platform: string,
  reduceMotion: boolean
): StackMotionAnimation {
  if (reduceMotion || platform === 'web') return 'none';
  if (platform === 'android') return 'ios_from_right';
  return 'simple_push';
}

export function resolveProgressFill(progress: number) {
  const value = Math.max(0, Math.min(100, progress));
  return {
    value,
    // Mantém avanços pequenos perceptíveis sem alterar o valor real anunciado.
    fill: value > 0 ? Math.max(value, 5) : 0,
  };
}

export function shouldUnmountModal(
  closingGeneration: number,
  currentGeneration: number,
  visible: boolean
) {
  return closingGeneration === currentGeneration && visible === false;
}

export function resolvePressFeedback(
  pressed: boolean,
  reduceMotion: boolean
): PressFeedbackState {
  return {
    duration: reduceMotion
      ? 0
      : pressed
        ? MOTION_DURATION.pressIn
        : MOTION_DURATION.pressOut,
    opacity: pressed ? MOTION_OPACITY.pressed : MOTION_OPACITY.rest,
    scale: reduceMotion
      ? MOTION_SCALE.rest
      : pressed
        ? MOTION_SCALE.pressed
        : MOTION_SCALE.rest,
  };
}
