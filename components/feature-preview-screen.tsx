import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListRow } from '@/components/ui/list-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Section } from '@/components/ui/section';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FeaturePreviewItem = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

type FeaturePreviewScreenProps = {
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  statusLabel?: string;
  items: FeaturePreviewItem[];
  onMenu?: () => void;
};

export function FeaturePreviewScreen({
  title,
  subtitle,
  description,
  icon,
  color,
  statusLabel,
  items,
  onMenu,
}: FeaturePreviewScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {onMenu ? (
        <ScreenHeader title={title} subtitle={subtitle} onMenu={onMenu} />
      ) : (
        <StackHeader title={title} onBack={() => router.back()} center />
      )}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <View style={styles.heroText}>
            {statusLabel ? <Badge label={statusLabel} tone="warning" icon="time-outline" /> : null}
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
          </View>
        </View>

        <Section title={subtitle}>
          <Card padded={false}>
            {items.map((item, index) => (
              <ListRow
                key={item.title}
                icon={item.icon}
                label={item.title}
                description={item.description}
                tone="neutral"
                showChevron={false}
                isLast={index === items.length - 1}
              />
            ))}
          </Card>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  heroIcon: {
    width: 28,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: Spacing.xs },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  description: { fontSize: FontSize.body, lineHeight: 21 },
});
