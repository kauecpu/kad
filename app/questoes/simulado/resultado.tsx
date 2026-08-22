import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SimulationReviewCard } from '@/components/simulation-question-card';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { StackHeader } from '@/components/ui/stack-header';
import { StatCard } from '@/components/ui/stat-card';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  simulationQuestionById,
  simulationScore,
} from '@/lib/simulations';
import { useApp } from '@/providers/app-provider';
import { useSimulation } from '@/providers/simulation-provider';
import { useQuestions } from '@/providers/questions-provider';

type ReviewMode = 'all' | 'wrong';

const REVIEW_OPTIONS: SegmentedOption<ReviewMode>[] = [
  { value: 'all', label: 'Todas' },
  { value: 'wrong', label: 'Somente erradas' },
];

export default function SimulationResultScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { canUseSimulations, subscriptionLoading } = useApp();
  const { session, discardSimulation } = useSimulation();
  const { questions } = useQuestions();
  const [reviewMode, setReviewMode] = useState<ReviewMode>('all');

  useEffect(() => {
    if (!subscriptionLoading && !canUseSimulations) {
      router.replace('/perfil/planos');
    }
  }, [canUseSimulations, router, subscriptionLoading]);

  const score = useMemo(
    () => (session ? simulationScore(session, questions) : null),
    [questions, session]
  );

  const reviewItems = useMemo(() => {
    if (!session) return [];
    return session.questions
      .map((item, index) => {
        const question = simulationQuestionById(item.questionId, questions);
        if (!question) return null;
        const selected = session.answers[item.questionId];
        return {
          ...item,
          index,
          question,
          selected,
          wrong: Boolean(selected && selected !== question.correct),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => reviewMode === 'all' || item.wrong);
  }, [questions, reviewMode, session]);

  const startNew = () => {
    discardSimulation();
    router.replace('/questoes/simulado/configurar');
  };

  if (subscriptionLoading || !canUseSimulations) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title="Resultado" onBack={() => router.replace('/questoes')} />
        <EmptyState
          icon={subscriptionLoading ? 'time-outline' : 'lock-closed-outline'}
          title={subscriptionLoading ? 'Verificando seu plano' : 'Resultados são um recurso premium'}
          description={
            subscriptionLoading
              ? 'Aguarde enquanto confirmamos sua assinatura.'
              : 'Escolha um plano KAD para revisar este resultado.'
          }
        />
      </View>
    );
  }

  if (!session || !score) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title="Resultado" onBack={() => router.replace('/questoes')} />
        <EmptyState
          icon="stats-chart-outline"
          title="Nenhum resultado disponível"
          description="Finalize um simulado para acompanhar seu desempenho."
          actionLabel="Montar simulado"
          onAction={() => router.replace('/questoes/simulado/configurar')}
        />
      </View>
    );
  }

  if (session.status !== 'completed') {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title="Resultado" onBack={() => router.replace('/questoes')} />
        <EmptyState
          icon="time-outline"
          title="Simulado em andamento"
          description="Continue ou finalize sua prova para ver o resultado completo."
          actionLabel="Continuar simulado"
          onAction={() => router.replace('/questoes/simulado')}
        />
      </View>
    );
  }

  const header = (
    <View style={styles.headerContent}>
      <View
        style={[
          styles.scoreHero,
          {
            borderBottomColor: colors.border,
          },
        ]}>
        <View
          accessible
          accessibilityLabel={`Aproveitamento de ${Math.round(score.accuracy)} por cento`}
          style={[
            styles.scoreCircle,
            {
              backgroundColor: 'transparent',
              borderColor: colors.primary,
            },
          ]}>
          <AnimatedCounter
            value={Math.round(score.accuracy)}
            suffix="%"
            accessibilityLabel={`${Math.round(score.accuracy)} por cento`}
            style={[styles.scoreValue, { color: colors.primary }]}
          />
        </View>
        <View style={styles.scoreText}>
          <Text style={[styles.scoreEyebrow, { color: colors.primary }]}>Aproveitamento</Text>
          <Text style={[styles.scoreTitle, { color: colors.text }]}>
            {score.accuracy >= 80
              ? 'Excelente resultado!'
              : score.accuracy >= 60
                ? 'Bom desempenho!'
                : 'Continue praticando'}
          </Text>
          <Text style={[styles.scoreDescription, { color: colors.textMuted }]}>
            {`${score.correct} de ${score.total} questões corretas`}
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon="checkmark-circle-outline"
          label="Acertos"
          value={String(score.correct)}
          animatedValue={score.correct}
          tone="success"
        />
        <StatCard
          icon="close-circle-outline"
          label="Erros"
          value={String(score.wrong)}
          animatedValue={score.wrong}
          tone="danger"
        />
      </View>
      <View style={styles.statsGrid}>
        <StatCard
          icon="remove-circle-outline"
          label="Em branco"
          value={String(score.blank)}
          animatedValue={score.blank}
          tone="neutral"
        />
        <StatCard
          icon="reader-outline"
          label="Respondidas"
          value={`${score.answered}/${score.total}`}
          tone="primary"
        />
      </View>

      <Card style={styles.performanceCard}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Desempenho por matéria
          </Text>
        </View>
        {score.bySubject.map((subject) => (
          <View key={subject.subject} style={styles.subjectRow}>
            <View style={styles.subjectHeader}>
              <Text style={[styles.subjectName, { color: colors.text }]} numberOfLines={1}>
                {subject.subject}
              </Text>
              <Text style={[styles.subjectValue, { color: colors.textMuted }]}>
                {`${subject.correct}/${subject.total} · ${Math.round(subject.accuracy)}%`}
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
              label={`Desempenho em ${subject.subject}`}
            />
          </View>
        ))}
      </Card>

      <View style={styles.actions}>
        <Button
          label="Novo simulado"
          icon="add-circle-outline"
          onPress={startNew}
          fullWidth
        />
        <Button
          label="Voltar para questões"
          variant="secondary"
          icon="reader-outline"
          onPress={() => router.replace('/questoes')}
          fullWidth
        />
      </View>

      <View style={styles.reviewHeader}>
        <Text style={[styles.reviewTitle, { color: colors.text }]}>Revisão da prova</Text>
        <Text style={[styles.reviewDescription, { color: colors.textMuted }]}>
          Confira o gabarito comentado ou foque apenas no que errou.
        </Text>
        <Segmented options={REVIEW_OPTIONS} value={reviewMode} onChange={setReviewMode} />
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Resultado do simulado" onBack={() => router.replace('/questoes')} />

      <FlatList
        data={reviewItems}
        keyExtractor={(item) => item.questionId}
        renderItem={({ item }) => (
          <View>
            <Text style={[styles.reviewPosition, { color: colors.textSubtle }]}>
              {`QUESTÃO ${item.index + 1} DE ${score.total}`}
            </Text>
            <SimulationReviewCard
              question={item.question}
              alternativeOrder={item.alternativeOrder}
              selected={item.selected}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.reviewEmpty}>
            <Ionicons name="trophy-outline" size={30} color={colors.success} />
            <Text style={[styles.reviewEmptyTitle, { color: colors.text }]}>
              Nenhuma questão errada
            </Text>
            <Text style={[styles.reviewEmptyText, { color: colors.textMuted }]}>
              Você acertou todas as questões respondidas.
            </Text>
          </View>
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
  },
  headerContent: { gap: Spacing.lg, marginBottom: Spacing.xl },
  scoreHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scoreCircle: {
    width: 82,
    height: 82,
    borderRadius: Radius.pill,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  scoreValue: {
    width: '100%',
    fontSize: 29,
    lineHeight: 34,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    textAlign: 'center',
  },
  scoreText: { flex: 1, minWidth: 0, gap: 3 },
  scoreEyebrow: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.semibold,
  },
  scoreTitle: {
    fontSize: FontSize.heading + 2,
    lineHeight: 23,
    fontWeight: FontWeight.bold,
  },
  scoreDescription: { fontSize: FontSize.body, lineHeight: 20 },
  statsGrid: { flexDirection: 'row', gap: Spacing.md },
  performanceCard: { gap: Spacing.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  subjectRow: { gap: Spacing.sm },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  subjectName: { flex: 1, fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  subjectValue: { fontSize: FontSize.small, fontWeight: FontWeight.medium },
  actions: { gap: Spacing.sm },
  reviewHeader: { gap: Spacing.sm },
  reviewTitle: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  reviewDescription: { fontSize: FontSize.small, lineHeight: 19 },
  reviewPosition: {
    marginBottom: Spacing.sm,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  reviewEmpty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  reviewEmptyTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  reviewEmptyText: { fontSize: FontSize.small, textAlign: 'center' },
});
