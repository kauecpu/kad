/** Tokens compartilhados para movimentos curtos e previsíveis no KAD. */
export const MOTION_DURATION = {
  pressIn: 110,
  pressOut: 140,
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
