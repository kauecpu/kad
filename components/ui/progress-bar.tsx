import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  MOTION_EASING,
  resolveMotionDuration,
  resolveProgressFill,
} from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';

type ProgressBarProps = {
  /** Progresso de 0 a 100. */
  value: number;
  color?: string;
  height?: number;
  label?: string;
};

export function ProgressBar({ value, color, height = 4, label }: ProgressBarProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const { value: clampedValue, fill } = resolveProgressFill(value);
  const animatedFill = useSharedValue(fill);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      animatedFill.value = fill;
      return;
    }

    cancelAnimation(animatedFill);
    const duration = resolveMotionDuration('progress', reduceMotion);
    if (duration === 0) {
      animatedFill.value = fill;
      return;
    }

    animatedFill.value = withTiming(fill, {
      duration,
      easing: Easing.bezier(...MOTION_EASING.standard),
    });
  }, [animatedFill, fill, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: animatedFill.value / 100 }],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clampedValue) }}
      style={[
        styles.track,
        { backgroundColor: colors.surfaceSunken, height, borderRadius: height },
      ]}>
      <Animated.View
        style={[
          styles.fill,
          animatedStyle,
          {
            backgroundColor: color ?? colors.primary,
            borderRadius: height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
    transformOrigin: 'left center',
  },
});
