import Ionicons from '@/components/ui/app-icon';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AnimatedCounter } from './animated-counter';
import { Card } from './card';
import { ProgressBar } from './progress-bar';
import { toneColors, type Tone } from './tone';

export type MetricOverviewItem = {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone: Tone;
};

type MetricOverviewProps = {
  label: string;
  value: number;
  valueSuffix?: string;
  description: string;
  progressValue: number;
  progressLabel: string;
  items: MetricOverviewItem[];
};

/**
 * Resumo analítico com uma métrica dominante e valores de apoio.
 * Use para resultados em que um indicador responde à pergunta principal da tela.
 */
export function MetricOverview({
  label,
  value,
  valueSuffix = '',
  description,
  progressValue,
  progressLabel,
  items,
}: MetricOverviewProps) {
  const { colors } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const stackItems = width < 390 || fontScale > 1.2;

  return (
    <Card
      style={[
        styles.card,
        { borderLeftColor: colors.insight },
      ]}>
      <View style={styles.primaryMetric}>
        <View style={styles.metricLabelRow}>
          <View style={[styles.metricIcon, { backgroundColor: colors.insightSoft }]}>
            <Ionicons name="analytics-outline" size={18} color={colors.insight} />
          </View>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
        </View>

        <AnimatedCounter
          value={value}
          suffix={valueSuffix}
          accessibilityLabel={`${label}: ${Math.round(value)}${valueSuffix}`}
          style={[styles.metricValue, { color: colors.insight }]}
        />
        <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
        <ProgressBar
          value={progressValue}
          color={colors.insight}
          trackColor={colors.surfaceSunken}
          height={6}
          label={progressLabel}
        />
      </View>

      <View
        style={[
          styles.supportingMetrics,
          { borderTopColor: colors.border },
          stackItems && styles.supportingMetricsStacked,
        ]}>
        {items.map((item) => {
          const tone = toneColors(colors, item.tone);
          return (
            <View
              key={item.label}
              accessible
              accessibilityLabel={`${item.label}: ${item.value}`}
              style={[
                styles.supportingItem,
                stackItems && styles.supportingItemStacked,
              ]}>
              <View style={[styles.supportingIcon, { backgroundColor: tone.background }]}>
                <Ionicons name={item.icon} size={16} color={tone.foreground} />
              </View>
              <View style={styles.supportingCopy}>
                <Text style={[styles.supportingValue, { color: tone.foreground }]}>
                  {item.value}
                </Text>
                <Text style={[styles.supportingLabel, { color: colors.textMuted }]}>
                  {item.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.xl,
    borderLeftWidth: Spacing.xs,
    padding: Spacing.xl,
  },
  primaryMetric: { gap: Spacing.sm },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  metricIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  metricLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  metricValue: {
    fontSize: FontSize.metric,
    fontWeight: FontWeight.bold,
    letterSpacing: -1.6,
    lineHeight: 62,
  },
  description: { fontSize: FontSize.small, lineHeight: 19 },
  supportingMetrics: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.lg,
  },
  supportingMetricsStacked: { flexDirection: 'column', gap: Spacing.sm },
  supportingItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  supportingItemStacked: { minHeight: 44 },
  supportingIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  supportingCopy: { flex: 1, minWidth: 0 },
  supportingValue: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  supportingLabel: { fontSize: FontSize.tiny, fontWeight: FontWeight.medium },
});
