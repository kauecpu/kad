import Ionicons from '@/components/ui/app-icon';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  MOTION_EASING,
  MOTION_OPACITY,
  resolveMotionDuration,
  resolvePressFeedback,
} from '@/constants/motion';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { StudyOptionState } from '@/lib/study-interactions';

type StudyOptionProps = {
  value: string;
  displayLetter?: string;
  text: string;
  state: StudyOptionState;
  selected: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const IS_WEB = Platform.OS === 'web';

export function StudyOption({
  value,
  displayLetter = value,
  text,
  state,
  selected,
  disabled = false,
  onPress,
}: StudyOptionProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();

  const palette = {
    idle: {
      background: colors.surface,
      border: colors.border,
      letterBackground: colors.surfaceAlt,
      letter: colors.textMuted,
      text: colors.text,
      elevation: 0,
    },
    selected: {
      background: colors.primarySoft,
      border: colors.primary,
      letterBackground: colors.primary,
      letter: colors.onPrimary,
      text: colors.text,
      elevation: 2,
    },
    correct: {
      background: colors.successSoft,
      border: colors.success,
      letterBackground: colors.success,
      letter: colors.surface,
      text: colors.text,
      elevation: 1,
    },
    incorrect: {
      background: colors.dangerSoft,
      border: colors.danger,
      letterBackground: colors.danger,
      letter: colors.surface,
      text: colors.text,
      elevation: 1,
    },
    muted: {
      background: colors.surface,
      border: colors.border,
      letterBackground: colors.surfaceAlt,
      letter: colors.textMuted,
      text: colors.textMuted,
      elevation: 0,
    },
  }[state];

  const backgroundColor = useSharedValue(palette.background);
  const borderColor = useSharedValue(palette.border);
  const elevation = useSharedValue(palette.elevation);
  const pressedProgress = useSharedValue(0);

  useEffect(() => {
    const duration = resolveMotionDuration('selection', reduceMotion);
    const config = {
      duration,
      easing: Easing.bezier(...MOTION_EASING.standard),
      reduceMotion: ReduceMotion.System,
    };

    cancelAnimation(backgroundColor);
    cancelAnimation(borderColor);
    cancelAnimation(elevation);
    backgroundColor.value = withTiming(palette.background, config);
    borderColor.value = withTiming(palette.border, config);
    elevation.value = withTiming(palette.elevation, config);
  }, [
    backgroundColor,
    borderColor,
    elevation,
    palette.background,
    palette.border,
    palette.elevation,
    reduceMotion,
  ]);

  const animatedStyle = useAnimatedStyle(() => {
    const common = {
      backgroundColor: backgroundColor.value,
      borderColor: borderColor.value,
      opacity: 1 - pressedProgress.value * (1 - MOTION_OPACITY.pressed),
    };

    if (IS_WEB) {
      return {
        ...common,
        boxShadow: `0 3px 10px rgba(0, 0, 0, ${elevation.value * 0.06})`,
      };
    }

    return {
      ...common,
      elevation: elevation.value,
      shadowOpacity: elevation.value > 0 ? 0.12 : 0,
    };
  });

  const updatePressedState = (pressed: boolean) => {
    cancelAnimation(pressedProgress);
    pressedProgress.value = withTiming(pressed ? 1 : 0, {
      duration: resolvePressFeedback(pressed, reduceMotion).duration,
      easing: Easing.bezier(...MOTION_EASING.standard),
      reduceMotion: ReduceMotion.System,
    });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => updatePressedState(true)}
      onPressOut={() => updatePressedState(false)}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      accessibilityLabel={`Alternativa ${displayLetter}: ${text}`}
      style={[
        styles.option,
        IS_WEB ? undefined : { shadowColor: colors.shadow },
        animatedStyle,
      ]}>
      <View style={[styles.letter, { backgroundColor: palette.letterBackground }]}>
        <Text style={[styles.letterText, { color: palette.letter }]}>{displayLetter}</Text>
      </View>
      <Text style={[styles.optionText, { color: palette.text }]}>{text}</Text>
      {state === 'correct' ? (
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
      ) : null}
      {state === 'incorrect' ? (
        <Ionicons name="close-circle" size={18} color={colors.danger} />
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 3 }, shadowRadius: 8 },
      default: {},
    }),
  },
  letter: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  optionText: {
    flex: 1,
    fontSize: FontSize.body,
    lineHeight: 21,
  },
});
