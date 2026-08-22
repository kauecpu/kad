import { useCallback } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  MOTION_EASING,
  MOTION_OPACITY,
  MOTION_SCALE,
  resolvePressFeedback,
} from '@/constants/motion';

type PressFeedbackProps = Omit<PressableProps, 'style'> & {
  style?: PressableProps['style'];
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Resposta visual reutilizável que não altera as dimensões do layout. */
export function PressFeedback({
  children,
  disabled,
  onPressIn,
  onPressOut,
  style,
  ...props
}: PressFeedbackProps) {
  const reduceMotion = useReducedMotion();
  const pressedProgress = useSharedValue(0);

  const updatePressedState = useCallback(
    (pressed: boolean) => {
      const feedback = resolvePressFeedback(pressed, reduceMotion);
      pressedProgress.value = withTiming(pressed ? 1 : 0, {
        duration: feedback.duration,
        easing: Easing.bezier(...MOTION_EASING.standard),
        reduceMotion: ReduceMotion.System,
      });
    },
    [pressedProgress, reduceMotion]
  );

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!disabled) updatePressedState(true);
      onPressIn?.(event);
    },
    [disabled, onPressIn, updatePressedState]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      updatePressedState(false);
      onPressOut?.(event);
    },
    [onPressOut, updatePressedState]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pressedProgress.value,
      [0, 1],
      [MOTION_OPACITY.rest, MOTION_OPACITY.pressed]
    ),
    transform: [
      {
        scale: reduceMotion
          ? MOTION_SCALE.rest
          : interpolate(
              pressedProgress.value,
              [0, 1],
              [MOTION_SCALE.rest, MOTION_SCALE.pressed]
            ),
      },
    ],
  }));

  const resolvedStyle: PressableProps['style'] =
    typeof style === 'function'
      ? (state) => [style(state), animatedStyle]
      : [style, animatedStyle];

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={resolvedStyle}>
      {children}
    </AnimatedPressable>
  );
}
