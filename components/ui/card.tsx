import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
};

/** Superfície base do app. Vira um botão quando recebe `onPress`. */
export function Card({ children, onPress, style, padded = true, accessibilityLabel }: CardProps) {
  const { colors } = useTheme();

  const base: StyleProp<ViewStyle> = [
    styles.card,
    padded && styles.padded,
    { backgroundColor: colors.surface, borderColor: colors.border },
    style,
  ];

  if (!onPress) {
    return <View style={base}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  padded: {
    padding: Spacing.lg,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});
