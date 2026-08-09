import Ionicons from '@/components/ui/app-icon';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

/** Chip de seleção usado nos filtros do aplicativo. */
export function Chip({ label, selected = false, onPress, icon }: ChipProps) {
  const { colors } = useTheme();

  const background = selected ? colors.primary : colors.surfaceAlt;
  const foreground = selected ? colors.onPrimary : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: background,
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}>
      {icon ? <Ionicons name={icon} size={14} color={foreground} /> : null}
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 1,
    borderRadius: Radius.pill,
    borderWidth: 0,
  },
  label: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
  },
});
