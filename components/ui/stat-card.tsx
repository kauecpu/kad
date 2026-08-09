import Ionicons from '@/components/ui/app-icon';
import { StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { toneColors, type Tone } from './tone';

type StatCardProps = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  hint?: string;
};

export function StatCard({ label, value, icon, tone = 'primary', hint }: StatCardProps) {
  const { colors } = useTheme();
  const { background, foreground } = toneColors(colors, tone);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: background },
      ]}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={16} color={foreground} />
        <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, { color: foreground }]} numberOfLines={1}>
        {value}
      </Text>
      {hint ? <Text style={[styles.hint, { color: colors.textSubtle }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 100,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 6,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.4,
  },
  label: {
    flex: 1,
    fontSize: FontSize.small,
  },
  hint: {
    fontSize: FontSize.tiny,
  },
});
