import { useEffect, useRef } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { MOTION_EASING, resolveMotionDuration } from '@/constants/motion';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type AnimatedCounterProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

function formatCounterValue(value: number, prefix: string, suffix: string) {
  'worklet';
  return `${prefix}${Math.round(value)}${suffix}`;
}

/** Anima somente a apresentação; o valor final permanece disponível à acessibilidade. */
export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  style,
  accessibilityLabel,
}: AnimatedCounterProps) {
  const reduceMotion = useReducedMotion();
  const displayedValue = useSharedValue(value);
  const didMount = useRef(false);
  const formattedValue = formatCounterValue(value, prefix, suffix);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      displayedValue.value = value;
      return;
    }

    cancelAnimation(displayedValue);
    const duration = resolveMotionDuration('counter', reduceMotion);
    if (duration === 0) {
      displayedValue.value = value;
      return;
    }

    displayedValue.value = withTiming(value, {
      duration,
      easing: Easing.bezier(...MOTION_EASING.standard),
    });
  }, [displayedValue, reduceMotion, value]);

  const animatedProps = useAnimatedProps(() => ({
    text: formatCounterValue(displayedValue.value, prefix, suffix),
  }));

  return (
    <View style={styles.container}>
      <Text
        accessible
        accessibilityLabel={accessibilityLabel ?? formattedValue}
        style={styles.accessibleValue}>
        {formattedValue}
      </Text>
      <AnimatedTextInput
        animatedProps={animatedProps as never}
        defaultValue={formattedValue}
        editable={false}
        focusable={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        underlineColorAndroid="transparent"
        style={[styles.value, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  accessibleValue: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  value: {
    width: '100%',
    alignSelf: 'stretch',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
    fontVariant: ['tabular-nums'],
  },
});
