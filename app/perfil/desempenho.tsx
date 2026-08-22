import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Section } from '@/components/ui/section';
import { StackHeader } from '@/components/ui/stack-header';
import { StatCard } from '@/components/ui/stat-card';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPercent } from '@/lib/format';
import { useApp } from '@/providers/app-provider';

export default function PerformanceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { performance, canViewStatistics, favoriteQuestionIds } = useApp();
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  const subjectPreviewSize = 3;
  const visibleSubjects = showAllSubjects
    ? performance.bySubject
    : performance.bySubject.slice(0, subjectPreviewSize);
  const hiddenSubjects = performance.bySubject.length - subjectPreviewSize;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Desempenho" onBack={() => router.back()} center />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        {canViewStatistics ? (
          <>
            <Section title="Visão geral">
              <View style={styles.statsRow}>
                <StatCard
                  icon="reader-outline"
                  label="Questões respondidas"
                  value={String(performance.total)}
                  animatedValue={performance.total}
                  tone="primary"
                />
                <StatCard
                  icon="checkmark-done-outline"
                  label="Taxa de acerto"
                  value={performance.total > 0 ? formatPercent(performance.accuracy) : '--'}
                  animatedValue={performance.total > 0 ? performance.accuracy : undefined}
                  valueSuffix="%"
                  tone="success"
                />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  icon="thumbs-up-outline"
                  label="Acertos"
                  value={String(performance.correct)}
                  animatedValue={performance.correct}
                  tone="success"
                />
                <StatCard
                  icon="thumbs-down-outline"
                  label="Erros"
                  value={String(performance.wrong)}
                  animatedValue={performance.wrong}
                  tone="danger"
                />
              </View>
            </Section>

            <Section title="Revisar questões">
              <Card padded={false} style={styles.reviewCard}>
                <ListRow
                  icon="bookmark-outline"
                  label="Favoritas"
                  value={String(favoriteQuestionIds.length)}
                  tone="primary"
                  onPress={() => router.push('/perfil/desempenho/questoes?tipo=favorites')}
                />
                <ListRow
                  icon="checkmark-circle-outline"
                  label="Acertadas"
                  value={String(performance.correct)}
                  tone="success"
                  onPress={() => router.push('/perfil/desempenho/questoes?tipo=correct')}
                />
                <ListRow
                  icon="close-circle-outline"
                  label="Erradas"
                  value={String(performance.wrong)}
                  tone="danger"
                  onPress={() => router.push('/perfil/desempenho/questoes?tipo=wrong')}
                  isLast
                />
              </Card>
            </Section>

            <Section title="Por matéria">
              {performance.bySubject.length > 0 ? (
                <Card style={styles.subjectCard}>
                  {visibleSubjects.map((subject) => (
                    <View key={subject.subject} style={styles.subjectRow}>
                      <View style={styles.subjectHeader}>
                        <Text style={[styles.subjectName, { color: colors.text }]} numberOfLines={1}>
                          {subject.subject}
                        </Text>
                        <Text style={[styles.subjectStat, { color: colors.textMuted }]}>
                          {`${subject.correct}/${subject.total} · ${formatPercent(subject.accuracy)}`}
                        </Text>
                      </View>
                      <ProgressBar
                        value={subject.accuracy}
                        color={
                          subject.accuracy >= 70
                            ? colors.success
                            : subject.accuracy >= 40
                              ? colors.warning
                              : colors.danger
                        }
                        label={`Acerto em ${subject.subject}`}
                      />
                    </View>
                  ))}

                  {hiddenSubjects > 0 ? (
                    <Pressable
                      onPress={() => setShowAllSubjects((current) => !current)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showAllSubjects }}
                      style={({ pressed }) => [
                        styles.seeMore,
                        { borderTopColor: colors.border },
                        pressed && styles.pressed,
                      ]}>
                      <Text style={[styles.seeMoreText, { color: colors.primary }]}>
                        {showAllSubjects ? 'Ver menos' : `Ver mais ${hiddenSubjects} matérias`}
                      </Text>
                      <Ionicons
                        name={showAllSubjects ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.primary}
                      />
                    </Pressable>
                  ) : null}
                </Card>
              ) : (
                <Card style={styles.emptyCard}>
                  <Ionicons name="bar-chart-outline" size={22} color={colors.textSubtle} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    Responda questões para acompanhar seu desempenho por matéria.
                  </Text>
                </Card>
              )}
            </Section>
          </>
        ) : (
          <Card style={styles.lockedCard}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
            <Text style={[styles.lockedTitle, { color: colors.text }]}>Desempenho não incluído</Text>
            <Text style={[styles.lockedText, { color: colors.textMuted }]}>
              A evolução e o desempenho por matéria estão disponíveis nos planos KAD.
            </Text>
            <Button
              label="Ver planos"
              icon="card-outline"
              onPress={() => router.push('/perfil/planos')}
            />
          </Card>
        )}
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
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  reviewCard: { overflow: 'hidden' },
  subjectCard: { gap: Spacing.lg },
  subjectRow: { gap: Spacing.sm },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  subjectName: { flex: 1, fontSize: FontSize.body, fontWeight: FontWeight.medium },
  subjectStat: { fontSize: FontSize.small, fontWeight: FontWeight.medium },
  seeMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  seeMoreText: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  emptyText: { flex: 1, fontSize: FontSize.small, lineHeight: 20 },
  lockedCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  lockedTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  lockedText: {
    maxWidth: 360,
    textAlign: 'center',
    fontSize: FontSize.body,
    lineHeight: 21,
  },
  pressed: { opacity: 0.6 },
});
