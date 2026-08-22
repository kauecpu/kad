import Ionicons from '@/components/ui/app-icon';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { MOTION_EASING, resolveMotionDuration } from '@/constants/motion';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'lg';
type ButtonIconMotion = 'forward' | 'backward' | 'up';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconMotion?: ButtonIconMotion;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconMotion,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const iconProgress = useSharedValue(0);

  const palette: Record<ButtonVariant, { background: string; foreground: string; border: string }> = {
    primary: { background: colors.primary, foreground: colors.onPrimary, border: colors.primary },
    secondary: {
      background: colors.primarySoft,
      foreground: colors.primary,
      border: colors.borderStrong,
    },
    ghost: { background: 'transparent', foreground: colors.textMuted, border: 'transparent' },
    danger: { background: colors.dangerSoft, foreground: colors.danger, border: colors.dangerSoft },
  };

  const { background, foreground, border } = palette[variant];
  const iconDistance = iconMotion === 'backward' ? -3 : iconMotion === 'up' ? -2 : 3;

  const animateIcon = (pressed: boolean) => {
    if (!iconMotion || disabled) return;
    cancelAnimation(iconProgress);
    iconProgress.value = withTiming(pressed ? 1 : 0, {
      duration: resolveMotionDuration('icon', reduceMotion),
      easing: Easing.bezier(...MOTION_EASING.standard),
      reduceMotion: ReduceMotion.System,
    });
  };

  const iconStyle = useAnimatedStyle(() => ({
    transform: !iconMotion
      ? []
      : iconMotion === 'up'
        ? [{ translateY: reduceMotion ? 0 : iconProgress.value * iconDistance }]
        : [{ translateX: reduceMotion ? 0 : iconProgress.value * iconDistance }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateIcon(true)}
      onPressOut={() => animateIcon(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        {
          backgroundColor: background,
          borderColor: border,
        },
        fullWidth && styles.fullWidth,
        (pressed || disabled) && {
          opacity: disabled ? 0.45 : 0.9,
          transform: iconMotion ? undefined : [{ scale: disabled ? 1 : 0.985 }],
        },
        style,
      ]}>
      {icon ? (
        <Animated.View
          style={iconStyle}
          accessibilityElementsHidden
          importantForAccessibility="no">
          <Ionicons name={icon} size={size === 'lg' ? 20 : 17} color={foreground} />
        </Animated.View>
      ) : null}
      <Text
        style={[
          styles.label,
          { color: foreground, fontSize: size === 'lg' ? FontSize.heading : FontSize.body },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  md: {
    minHeight: 46,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  lg: {
    minHeight: 52,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontWeight: FontWeight.semibold,
  },
});
