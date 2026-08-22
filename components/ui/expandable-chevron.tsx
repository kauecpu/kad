import Ionicons from '@/components/ui/app-icon';
import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { MOTION_EASING, resolveMotionDuration } from '@/constants/motion';

type ExpandableChevronProps = {
  expanded: boolean;
  color: string;
};

/** O ícone se move dentro do controle; o botão não muda de posição. */
export function ExpandableChevron({ expanded, color }: ExpandableChevronProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: resolveMotionDuration('icon', reduceMotion),
      easing: Easing.bezier(...MOTION_EASING.standard),
      reduceMotion: ReduceMotion.System,
    });
  }, [expanded, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduceMotion ? 0 : interpolate(progress.value, [0, 1], [0, -2]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  return (
    <Animated.View style={animatedStyle} accessibilityElementsHidden importantForAccessibility="no">
      <Ionicons name="chevron-down" size={17} color={color} />
    </Animated.View>
  );
}
