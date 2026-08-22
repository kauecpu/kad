import Ionicons from '@/components/ui/app-icon';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { MOTION_DURATION, MOTION_EASING, resolveMotionDuration } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { triggerHapticFeedback } from '@/lib/haptics';
import { createStudyActionGate, performStudyAction } from '@/lib/study-interactions';
import { useApp } from '@/providers/app-provider';

type QuestionFavoriteButtonProps = {
  questionId: string;
};

export function QuestionFavoriteButton({ questionId }: QuestionFavoriteButtonProps) {
  const { colors } = useTheme();
  const { favoriteQuestionIds, toggleFavoriteQuestion } = useApp();
  const isFavorite = favoriteQuestionIds.includes(questionId);
  const reduceMotion = useReducedMotion();
  const reaction = useSharedValue(0);
  const mounted = useRef(false);
  const toggleGate = useRef(createStudyActionGate());
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const gate = toggleGate.current;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    gate.reset();
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      gate.reset();
    };
  }, [questionId]);

  useEffect(() => {
    cancelAnimation(reaction);

    if (!mounted.current) {
      mounted.current = true;
      reaction.value = 0;
      return;
    }

    const duration = resolveMotionDuration('reaction', reduceMotion);
    if (duration === 0) {
      reaction.value = 0;
      return;
    }

    reaction.value = withSequence(
      withTiming(1, {
        duration: Math.round(duration / 2),
        easing: Easing.bezier(...MOTION_EASING.standard),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(0, {
        duration: Math.round(duration / 2),
        easing: Easing.bezier(...MOTION_EASING.standard),
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [isFavorite, reaction, reduceMotion]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduceMotion ? 0 : interpolate(reaction.value, [0, 1], [0, -2]) },
      { scale: reduceMotion ? 1 : interpolate(reaction.value, [0, 1], [1, 1.12]) },
    ],
  }));

  const handleToggle = () => {
    const accepted = performStudyAction({
      gate: toggleGate.current,
      commit: () => toggleFavoriteQuestion(questionId),
      feedback: () => triggerHapticFeedback('toggle-favorite'),
    });
    if (!accepted) return;

    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(
      () => toggleGate.current.reset(),
      MOTION_DURATION.reaction
    );
  };

  return (
    <Pressable
      onPress={handleToggle}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? 'Remover questão dos favoritos' : 'Favoritar questão'}
      accessibilityState={{ selected: isFavorite }}
      aria-pressed={isFavorite}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Animated.View style={iconStyle}>
        <Ionicons
          name={isFavorite ? 'bookmark' : 'bookmark-outline'}
          size={21}
          color={isFavorite ? colors.primary : colors.textSubtle}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.55 },
});
