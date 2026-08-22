import { StyleSheet, Text, View } from 'react-native';

import Ionicons from '@/components/ui/app-icon';
import { PressFeedback } from '@/components/ui/press-feedback';
import { FontSize, FontWeight, Radius, Spacing, cardShadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppFeatureIcon } from '@/lib/app-feature-catalog';

type FeatureLinkCardProps = {
  icon: AppFeatureIcon;
  title: string;
  description: string;
  onPress: () => void;
};

export function FeatureLinkCard({ icon, title, description, onPress }: FeatureLinkCardProps) {
  const { colors } = useTheme();

  return (
    <PressFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        cardShadow(colors.shadow, 1),
      ]}>
      <View style={styles.topRow}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={icon} size={20} color={colors.primary} filled={false} />
        </View>
        <Ionicons name="arrow-forward" size={17} color={colors.textSubtle} filled={false} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
      </View>
    </PressFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 156,
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  copy: { minWidth: 0, gap: Spacing.xs },
  title: { fontSize: FontSize.body, fontWeight: FontWeight.bold, flexShrink: 1 },
  description: { fontSize: FontSize.small, lineHeight: 19, flexShrink: 1 },
});
