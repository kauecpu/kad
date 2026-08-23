import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  RecentStudyCard,
  StudyMomentumCard,
} from '@/components/home-study-momentum';
import { Avatar } from '@/components/ui/avatar';
import { FeaturedCard } from '@/components/ui/featured-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { PressFeedback } from '@/components/ui/press-feedback';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Section } from '@/components/ui/section';
import {
  CONTENT_MAX_WIDTH,
  FontSize,
  FontWeight,
  Fonts,
  Radius,
  Spacing,
} from '@/constants/theme';
import { QUESTIONS } from '@/data/questions';
import { useTheme } from '@/hooks/use-theme';
import { useOpenAppDrawer } from '@/hooks/use-open-app-drawer';
import { deadlineInfo, recommendConcursosForGoal, sortConcursos } from '@/lib/concursos';
import { getHomePrimaryAction, getHomePrimaryVisual } from '@/lib/home-presentation';
import { buildStudyMomentum } from '@/lib/study-momentum';
import { useApp } from '@/providers/app-provider';
import { useConcursos } from '@/providers/concursos-provider';
import { useSimulation } from '@/providers/simulation-provider';

export function HomeContent() {
  const { colors } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const router = useRouter();
  const openMenu = useOpenAppDrawer();
  const {
    profile,
    isPremium,
    answers,
    questionActivityByDate,
    dailyQuestionsAnswered,
    weeklyQuestionGoal,
    setWeeklyQuestionGoal,
    savedConcursos,
  } = useApp();
  const { session, history } = useSimulation();
  const { concursos } = useConcursos();

  const firstName = profile.name.trim().split(/\s+/)[0] || 'Estudante';
  const targetRole = profile.targetRole?.trim() ?? '';
  const savedActiveConcursos = sortConcursos(
    concursos.filter(
      (concurso) => savedConcursos.includes(concurso.id) && concurso.status !== 'encerrado'
    ),
    'deadline'
  );
  const savedFocus = savedActiveConcursos[0];
  const recommendedConcursos = targetRole
    ? recommendConcursosForGoal(
        concursos.filter((concurso) => concurso.status !== 'encerrado'),
        targetRole
      )
    : [];
  const focusConcurso =
    savedFocus ??
    recommendedConcursos.find((concurso) => concurso.status === 'aberto') ??
    recommendedConcursos[0];
  const focusDeadlineCandidate =
    focusConcurso?.status === 'aberto' && focusConcurso.registrationEnd
      ? deadlineInfo(focusConcurso)
      : null;
  const focusDeadline =
    focusDeadlineCandidate?.tone !== 'neutral' ? focusDeadlineCandidate : null;
  const hasGoal = Boolean(targetRole || savedFocus);
  const hasWrongAnswers = Object.values(answers).some((answer) => !answer.isCorrect);
  const answeredInSimulation = session ? Object.keys(session.answers).length : 0;
  const primaryAction = getHomePrimaryAction({
    hasGoal,
    hasWrongAnswers,
    simulation: isPremium && session
      ? {
          status: session.status,
          answered: answeredInSimulation,
          total: session.questions.length,
        }
      : undefined,
  });
  const primaryVisual = getHomePrimaryVisual(primaryAction);
  const studyMomentum = useMemo(
    () =>
      buildStudyMomentum({
        answers,
        questionActivityByDate,
        simulationHistory: history,
        questions: QUESTIONS,
        weeklyGoal: weeklyQuestionGoal,
        recentLimit: 2,
      }),
    [answers, history, questionActivityByDate, weeklyQuestionGoal]
  );
  const weeklyRemaining = Math.max(
    0,
    studyMomentum.weeklyGoal - studyMomentum.weeklyQuestions
  );
  const stackSummary = width < 360 || fontScale >= 1.3;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        onMenu={openMenu}
        title={`Olá, ${firstName}`}
        subtitle={targetRole ? `Central KAD · ${targetRole}` : 'Sua central de preparação'}
        right={
          <Pressable
            onPress={() => router.push('/perfil')}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}>
            <Avatar name={profile.name} uri={profile.avatarUri} size={40} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FeaturedCard
          onPress={() => router.push(primaryAction.route)}
          accessibilityLabel={`${primaryAction.title}. ${primaryAction.description}`}
          intensity="strong"
          tone={primaryVisual.tone}
          icon={
            primaryAction.route === '/meta'
              ? 'navigate-outline'
              : primaryAction.route === '/questoes/simulado/resultado'
                ? 'stats-chart-outline'
                : primaryAction.route === '/questoes/simulado'
                  ? 'timer-outline'
                  : primaryAction.route === '/perfil/desempenho/questoes?tipo=wrong'
                    ? 'refresh-outline'
                    : 'flash-outline'
          }
          eyebrow={primaryAction.eyebrow}
          title={primaryAction.title}
          description={primaryAction.description}
          motionFeedback
          actionLabel="Abrir próximo passo">
          {primaryAction.progress !== undefined ? (
            <ProgressBar
              value={primaryAction.progress}
              color={colors.onBrand}
              trackColor={colors.brandTrace}
              height={5}
              label={`Progresso do simulado: ${Math.round(primaryAction.progress)}%`}
            />
          ) : null}
        </FeaturedCard>

        <View
          accessible
          accessibilityLabel="Resumo da preparação"
          style={[styles.summaryGrid, stackSummary && styles.summaryGridStacked]}>
          <View
            accessible
            accessibilityLabel={`${dailyQuestionsAnswered} questões respondidas hoje`}
            style={[
              styles.summaryCard,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={colors.primary}
                aria-hidden={true}
              />
            </View>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {dailyQuestionsAnswered}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Questões hoje</Text>
          </View>

          <View
            accessible
            accessibilityLabel={`${studyMomentum.weeklyQuestions} de ${studyMomentum.weeklyGoal} questões da meta semanal${weeklyRemaining > 0 ? `. Faltam ${weeklyRemaining} questões` : '. Meta concluída'}`}
            style={[
              styles.summaryCard,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}>
            <View style={styles.summaryHeading}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {studyMomentum.weeklyQuestions} de {studyMomentum.weeklyGoal}
              </Text>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons
                  name="flag-outline"
                  size={18}
                  color={colors.primary}
                  aria-hidden={true}
                />
              </View>
            </View>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Meta semanal</Text>
            {weeklyRemaining > 0 ? (
              <Text style={[styles.summaryHint, { color: colors.textMuted }]}>
                Faltam {weeklyRemaining} questões
              </Text>
            ) : null}
            <ProgressBar
              value={studyMomentum.weeklyProgress}
              color={colors.primary}
              height={5}
              label={`Meta semanal: ${studyMomentum.weeklyQuestions} de ${studyMomentum.weeklyGoal} questões`}
            />
          </View>
        </View>

        <Section title="Seu ritmo">
          <StudyMomentumCard
            momentum={studyMomentum}
            onGoalChange={setWeeklyQuestionGoal}
          />
        </Section>

        <Section title="Atividade recente">
          <RecentStudyCard
            activities={studyMomentum.recentActivities}
            onOpen={(route) => router.push(route)}
            onStart={() => router.push('/questoes/desafio')}
          />
        </Section>

        {focusConcurso && focusDeadline ? (
          <Section title="Prazo da sua meta">
            <PressFeedback
              onPress={() => router.push(`/concurso/${focusConcurso.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${focusConcurso.shortName}. ${focusDeadline.label}`}
              style={[
                styles.deadlineAlert,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.deadlineIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={focusDeadline.icon} size={20} color={colors.primary} aria-hidden />
              </View>
              <View style={styles.deadlineCopy}>
                <Text style={[styles.deadlineTitle, { color: colors.text }]}>
                  {focusConcurso.shortName} · {focusConcurso.title}
                </Text>
                <Text style={[styles.deadlineLabel, { color: colors.primary }]}>
                  {focusDeadline.label}
                </Text>
              </View>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ionicons name="chevron-forward" size={19} color={colors.textSubtle} aria-hidden />
              </View>
            </PressFeedback>
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  return <HomeContent />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xl,
  },
  summaryGrid: { flexDirection: 'row', gap: Spacing.sm },
  summaryGridStacked: { flexDirection: 'column' },
  summaryCard: {
    minWidth: 0,
    minHeight: 108,
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  summaryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.heading,
    lineHeight: 22,
    fontWeight: FontWeight.bold,
  },
  summaryLabel: { fontSize: FontSize.tiny, fontWeight: FontWeight.medium },
  summaryHint: { fontSize: FontSize.tiny, lineHeight: 16 },
  deadlineAlert: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  deadlineIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deadlineCopy: { minWidth: 0, flex: 1, gap: 3 },
  deadlineTitle: { fontSize: FontSize.small, lineHeight: 19, fontWeight: FontWeight.semibold },
  deadlineLabel: { fontSize: FontSize.tiny, lineHeight: 16, fontWeight: FontWeight.bold },
  pressed: { opacity: 0.65 },
});
