import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
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
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();

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

  return (
    <Pressable
      onPress={onPress}
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
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 },
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={size === 'lg' ? 20 : 17} color={foreground} /> : null}
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
    paddingVertical: Spacing.sm + 3,
    paddingHorizontal: Spacing.lg,
  },
  lg: {
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontWeight: FontWeight.semibold,
  },
});
