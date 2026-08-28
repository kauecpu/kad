import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { MetricOverview } from '@/components/ui/metric-overview';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Section } from '@/components/ui/section';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPercent } from '@/lib/format';
import { useApp } from '@/providers/app-provider';

export default function PerformanceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { performance, canViewStatistics, favoriteQuestionIds, subscriptionLoading } = useApp();
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
        {subscriptionLoading ? (
          <Card style={styles.stateCard}>
            <ActivityIndicator color={colors.insight} accessibilityLabel="Carregando desempenho" />
            <Text accessibilityRole="header" style={[styles.stateTitle, { color: colors.text }]}>
              Carregando seu desempenho
            </Text>
            <Text style={[styles.stateText, { color: colors.textMuted }]}>
              Aguarde enquanto confirmamos seu plano.
            </Text>
          </Card>
        ) : canViewStatistics && performance.total > 0 ? (
          <>
            <MetricOverview
              label="Taxa de acerto"
              value={performance.accuracy}
              valueSuffix="%"
              description={`${performance.correct} de ${performance.total} respostas corretas`}
              progressValue={performance.accuracy}
              progressLabel="Taxa geral de acerto"
              items={[
                {
                  label: 'Respondidas',
                  value: performance.total,
                  icon: 'reader-outline',
                  tone: 'primary',
                },
                {
                  label: 'Acertos',
                  value: performance.correct,
                  icon: 'checkmark-circle-outline',
                  tone: 'success',
                },
                {
                  label: 'Erros',
                  value: performance.wrong,
                  icon: 'close-circle-outline',
                  tone: 'danger',
                },
              ]}
            />

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
                        color={colors.insight}
                        trackColor={colors.surfaceSunken}
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
                      <Text style={[styles.seeMoreText, { color: colors.insight }]}>
                        {showAllSubjects ? 'Ver menos' : `Ver mais ${hiddenSubjects} matérias`}
                      </Text>
                      <Ionicons
                        name={showAllSubjects ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.insight}
                      />
                    </Pressable>
                  ) : null}
                </Card>
              ) : (
                <Card style={styles.emptyCard}>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.insightSoft }]}>
                    <Ionicons name="bar-chart-outline" size={22} color={colors.insight} />
                  </View>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    Responda questões para acompanhar seu desempenho por matéria.
                  </Text>
                </Card>
              )}
            </Section>
          </>
        ) : canViewStatistics ? (
          <Card style={styles.emptyStateCard}>
            <View style={[styles.emptyStateIcon, { backgroundColor: colors.insightSoft }]}>
              <Ionicons name="analytics-outline" size={28} color={colors.insight} />
            </View>
            <Text accessibilityRole="header" style={[styles.stateTitle, { color: colors.text }]}>
              Seu desempenho começa aqui
            </Text>
            <Text style={[styles.stateText, { color: colors.textMuted }]}>
              Responda uma questão para ver acertos, erros e evolução por matéria.
            </Text>
            <Button
              label="Responder questões"
              icon="reader-outline"
              onPress={() => router.push('/questoes')}
            />
          </Card>
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
    minHeight: 44,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  seeMoreText: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  emptyIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  emptyText: { flex: 1, fontSize: FontSize.small, lineHeight: 20 },
  stateCard: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  emptyStateCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
  },
  stateTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold, textAlign: 'center' },
  stateText: {
    maxWidth: 380,
    fontSize: FontSize.body,
    lineHeight: 22,
    textAlign: 'center',
  },
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
