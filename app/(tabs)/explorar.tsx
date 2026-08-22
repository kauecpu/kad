import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { FeatureLinkCard } from '@/components/ui/feature-link-card';
import { ListRow } from '@/components/ui/list-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Section } from '@/components/ui/section';
import { CONTENT_MAX_WIDTH, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  APP_FEATURE_GROUPS,
  exploreColumnCount,
  featuresForGroup,
  type AppFeature,
} from '@/lib/app-feature-catalog';
import { useApp } from '@/providers/app-provider';

export default function ExploreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useApp();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const singleColumn = exploreColumnCount(fontScale) === 1;

  const practice = featuresForGroup('practice');
  const progress = featuresForGroup('progress');
  const other = featuresForGroup('other');
  const account = featuresForGroup('account');
  const openFeature = (feature: AppFeature) => router.push(feature.href);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Explorar"
        subtitle="Tudo que você pode fazer no KAD"
        right={
          <Pressable
            onPress={() => router.push('/perfil')}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
            hitSlop={8}
            style={({ pressed }) => [
              styles.profileButton,
              { borderColor: colors.borderStrong },
              pressed && styles.pressed,
            ]}>
            <Avatar name={profile.name} uri={profile.avatarUri} size={38} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}>
        <Section title={APP_FEATURE_GROUPS[0].title}>
          <View style={[styles.grid, singleColumn && styles.singleColumn]}>
            {practice.map((feature) => (
              <View
                key={feature.id}
                style={[styles.gridItem, singleColumn && styles.gridItemSingle]}>
                <FeatureLinkCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  onPress={() => openFeature(feature)}
                />
              </View>
            ))}
          </View>
        </Section>

        <Section title={APP_FEATURE_GROUPS[1].title}>
          {progress.map((feature) => (
            <FeatureLinkCard
              key={feature.id}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              onPress={() => openFeature(feature)}
            />
          ))}
        </Section>

        <Section title={APP_FEATURE_GROUPS[2].title}>
          <Card padded={false}>
            {other.map((feature, index) => (
              <ListRow
                key={feature.id}
                icon={feature.icon}
                label={feature.title}
                description={feature.description}
                onPress={() => openFeature(feature)}
                isLast={index === other.length - 1}
              />
            ))}
          </Card>
        </Section>

        <Section title={APP_FEATURE_GROUPS[3].title}>
          <Card padded={false}>
            {account.map((feature, index) => (
              <ListRow
                key={feature.id}
                icon={feature.icon}
                label={feature.title}
                description={feature.description}
                onPress={() => openFeature(feature)}
                isLast={index === account.length - 1}
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
    gap: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  profileButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  singleColumn: { flexDirection: 'column' },
  gridItem: { flexBasis: '46%', flexGrow: 1, minWidth: 0 },
  gridItemSingle: { flexBasis: '100%' },
  pressed: { opacity: 0.72 },
});
