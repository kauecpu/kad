import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { type KadMascotVariant } from '@/constants/mascots';

export type { KadMascotVariant } from '@/constants/mascots';

type KadMascotProps = {
  size?: number;
  active?: boolean;
  motion?: 'float' | 'celebrate';
  variant?: KadMascotVariant;
  style?: StyleProp<ImageStyle>;
};

const MASCOT_SOURCES = {
  welcome: require('../assets/images/kad-mascot-wolf-writing.png'),
  practice: require('../assets/images/kad-mascot-wolf-practice.png'),
  simulation: require('../assets/images/kad-mascot-wolf-simulation.png'),
  goal: require('../assets/images/kad-mascot-wolf-goal-study.png'),
} as const;

export function KadMascot({
  size = 220,
  active = true,
  motion = 'float',
  variant = 'welcome',
  style,
}: KadMascotProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.stopAnimation();

    if (!active) {
      progress.setValue(0);
      return;
    }

    const duration = motion === 'celebrate' ? 620 : 1350;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [active, motion, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: motion === 'celebrate' ? [0, -12] : [0, -7],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: motion === 'celebrate' ? ['-2deg', '2deg'] : ['-0.8deg', '0.8deg'],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: motion === 'celebrate' ? [1, 1.035] : [1, 1.012],
  });

  return (
    <Animated.Image
      source={MASCOT_SOURCES[variant]}
      resizeMode="contain"
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      accessibilityIgnoresInvertColors
      style={[
        styles.image,
        { width: size, height: size, transform: [{ translateY }, { rotate }, { scale }] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    alignSelf: 'center',
  },
});
