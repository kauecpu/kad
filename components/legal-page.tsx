import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { StackHeader } from '@/components/ui/stack-header';
import {
  CONTENT_MAX_WIDTH,
  FontSize,
  FontWeight,
  Radius,
  Spacing,
  cardShadow,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  note?: string;
};

type LegalPageProps = {
  title: string;
  introduction: string;
  sections: LegalSection[];
  documentIcon: keyof typeof Ionicons.glyphMap;
  effectiveDate: string;
  readingTime: string;
  version: string;
};

export function LegalPage({
  title,
  introduction,
  sections,
  documentIcon,
  effectiveDate,
  readingTime,
  version,
}: LegalPageProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      <StackHeader title={title} onBack={() => router.back()} center />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        <Card
          style={[
            styles.documentHeader,
            { backgroundColor: colors.surface, borderColor: colors.border },
            cardShadow(colors.shadow, 1),
          ]}>
          <View style={styles.documentTopRow}>
            <View style={[styles.documentIcon, { backgroundColor: colors.primarySoft }]}> 
              <Ionicons name={documentIcon} size={24} color={colors.primary} />
            </View>
            <View style={[styles.versionBadge, { backgroundColor: colors.primarySoft }]}> 
              <Text style={[styles.versionText, { color: colors.primary }]}>VERSÃO {version}</Text>
            </View>
          </View>

          <Text style={[styles.introductionBody, { color: colors.text }]}>{introduction}</Text>

          <View style={[styles.metadata, { borderTopColor: colors.border }]}> 
            <MetadataItem
              icon="calendar-clear-outline"
              label="Vigência"
              value={effectiveDate}
              color={colors.textMuted}
            />
            <View style={[styles.metadataDivider, { backgroundColor: colors.border }]} />
            <MetadataItem
              icon="time-outline"
              label="Leitura"
              value={readingTime}
              color={colors.textMuted}
            />
          </View>
        </Card>

        <View style={styles.sections}>
          {sections.map((section, index) => (
            <View key={section.title} style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={[styles.sectionNumber, { backgroundColor: colors.primarySoft }]}> 
                  <Text style={[styles.sectionNumberText, { color: colors.primary }]}> 
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                </View>
                <Text
                  accessibilityRole="header"
                  style={[styles.sectionTitle, { color: colors.text }]}> 
                  {section.title}
                </Text>
              </View>

              <View style={styles.sectionContent}>
                {section.paragraphs.map((paragraph) => (
                  <Text key={paragraph} style={[styles.paragraph, { color: colors.textMuted }]}> 
                    {paragraph}
                  </Text>
                ))}
                {section.bullets?.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.bulletText, { color: colors.textMuted }]}>{bullet}</Text>
                  </View>
                ))}
                {section.note ? (
                  <View
                    style={[
                      styles.sectionNote,
                      { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
                    ]}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                    <Text style={[styles.sectionNoteText, { color: colors.textMuted }]}> 
                      {section.note}
                    </Text>
                  </View>
                ) : null}
              </View>

              {index < sections.length - 1 ? (
                <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
              ) : null}
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

function MetadataItem({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.metadataItem}>
      <Ionicons name={icon} size={17} color={color} />
      <View style={styles.metadataText}>
        <Text style={[styles.metadataLabel, { color }]}>{label}</Text>
        <Text style={[styles.metadataValue, { color }]}>{value}</Text>
      </View>
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
    gap: Spacing.xxl,
  },
  documentHeader: {
    gap: Spacing.lg,
    padding: Spacing.lg,
  },
  documentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  documentIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  versionText: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  introductionBody: {
    fontSize: FontSize.heading,
    lineHeight: 24,
    fontWeight: FontWeight.medium,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
  },
  metadataItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metadataDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.md,
  },
  metadataText: { flex: 1, gap: 1 },
  metadataLabel: { fontSize: FontSize.tiny, fontWeight: FontWeight.medium },
  metadataValue: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  sections: { gap: 0 },
  section: { gap: Spacing.lg },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sectionNumber: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    flex: 1,
    fontSize: FontSize.heading,
    lineHeight: 21,
    fontWeight: FontWeight.bold,
  },
  sectionContent: { gap: Spacing.md, paddingLeft: 46 },
  paragraph: { fontSize: FontSize.body, lineHeight: 23 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    marginTop: 8,
  },
  bulletText: { flex: 1, fontSize: FontSize.body, lineHeight: 22 },
  sectionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  sectionNoteText: { flex: 1, fontSize: FontSize.small, lineHeight: 20 },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xxl,
    marginLeft: 46,
  },
});
