import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type ProgressBarProps = {
  /** Progresso de 0 a 100. */
  value: number;
  color?: string;
  height?: number;
  label?: string;
};

export function ProgressBar({ value, color, height = 4, label }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  // Garante que qualquer progresso maior que zero fique visível.
  const fillWidth = clamped > 0 ? Math.max(clamped, 5) : 0;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={[
        styles.track,
        { backgroundColor: colors.surfaceSunken, height, borderRadius: height },
      ]}>
      <View
        style={[
          styles.fill,
          {
            width: `${fillWidth}%`,
            backgroundColor: color ?? colors.primary,
            borderRadius: height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
