import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { toneColors, type Tone } from './tone';

type ListRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  value?: string;
  tone?: Tone;
  destructive?: boolean;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
};

/** Linha de lista usada nas configurações de conta. */
export function ListRow({
  icon,
  label,
  description,
  value,
  tone = 'neutral',
  destructive = false,
  onPress,
  showChevron = true,
  isLast = false,
}: ListRowProps) {
  const { colors } = useTheme();
  const iconTone = toneColors(colors, destructive ? 'danger' : tone);
  const labelColor = destructive ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={description}
      style={({ pressed }) => [
        styles.container,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}>
      <View style={styles.iconWrapper}>
        <Ionicons name={icon} size={17} color={iconTone.foreground} />
      </View>

      <View style={styles.textGroup}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
        ) : null}
      </View>

      {value ? <Text style={[styles.value, { color: colors.textMuted }]}>{value}</Text> : null}
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  iconWrapper: {
    width: 22,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  description: {
    fontSize: FontSize.small,
  },
  value: {
    fontSize: FontSize.small,
  },
});
