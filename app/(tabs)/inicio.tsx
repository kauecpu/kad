import Ionicons from '@/components/ui/app-icon';
import { type Href, useRouter } from 'expo-router';
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
import { KadMascot } from '@/components/kad-mascot';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import { deadlineInfo, recommendConcursosForGoal, sortConcursos } from '@/lib/concursos';
import { formatSalaryShort } from '@/lib/format';
import { getHomePrimaryAction, getHomePrimaryVisual } from '@/lib/home-presentation';
import { buildStudyMomentum } from '@/lib/study-momentum';
import { useApp } from '@/providers/app-provider';
import { useConcursos } from '@/providers/concursos-provider';
import { useSimulation } from '@/providers/simulation-provider';

type HomeAction = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: Href;
};

type ExploreAction = Omit<HomeAction, 'icon'> & { marker: string };

const PRACTICE_ACTIONS: HomeAction[] = [
  {
    title: 'Questões',
    description: 'Praticar por assunto',
    icon: 'reader-outline',
    route: '/questoes',
  },
  {
    title: 'Simulados',
    description: 'Treinar ritmo de prova',
    icon: 'timer-outline',
    route: '/simulados',
  },
  {
    title: 'Trilhas',
    description: 'Seguir uma sequência',
    icon: 'map-outline',
    route: '/trilhas',
  },
];

const EXPLORE_ACTIONS: ExploreAction[] = [
  {
    title: 'Redação',
    description: 'Escolha um tema e pratique sua escrita',
    marker: 'R',
    route: '/redacao',
  },
  {
    title: 'Biblioteca',
    description: 'Audiobooks, anotações e flashcards em breve',
    marker: 'B',
    route: '/biblioteca',
  },
  {
    title: 'Desafio rápido',
    description: 'Resolva 3 questões em cerca de 5 minutos',
    marker: '05',
    route: '/questoes/desafio',
  },
];

export function HomeContent() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
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
  const focusDeadline = focusConcurso ? deadlineInfo(focusConcurso) : null;
  const hasGoal = Boolean(targetRole || savedFocus);
  const answeredInSimulation = session ? Object.keys(session.answers).length : 0;
  const primaryAction = getHomePrimaryAction({
    hasGoal,
    simulation: isPremium && session
      ? {
          status: session.status,
          answered: answeredInSimulation,
          total: session.questions.length,
        }
      : undefined,
  });
  const primaryVisual = getHomePrimaryVisual(primaryAction);
  const primaryArtworkSize = width < 420 ? 88 : width < 768 ? 108 : 128;
  const studyMomentum = useMemo(
    () =>
      buildStudyMomentum({
        answers,
        questionActivityByDate,
        simulationHistory: history,
        questions: QUESTIONS,
        weeklyGoal: weeklyQuestionGoal,
      }),
    [answers, history, questionActivityByDate, weeklyQuestionGoal]
  );
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
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
          artwork={
            <KadMascot
              variant={primaryVisual.mascot}
              size={primaryArtworkSize}
              active={false}
            />
          }
          icon={
            primaryAction.route === '/meta'
              ? 'navigate-outline'
              : primaryAction.route === '/questoes/simulado/resultado'
                ? 'stats-chart-outline'
                : primaryAction.route === '/questoes/simulado'
                  ? 'timer-outline'
                  : 'book-outline'
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
              height={5}
              label={`Progresso do simulado: ${Math.round(primaryAction.progress)}%`}
            />
          ) : null}
        </FeaturedCard>

        <View
          accessible
          accessibilityLabel="Resumo da preparação"
          style={styles.summaryGrid}>
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
            accessibilityLabel={`${studyMomentum.weeklyQuestions} de ${studyMomentum.weeklyGoal} questões da meta semanal`}
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
            <ProgressBar
              value={studyMomentum.weeklyProgress}
              color={colors.primary}
              height={5}
              label={`Meta semanal: ${studyMomentum.weeklyQuestions} de ${studyMomentum.weeklyGoal} questões`}
            />
          </View>
        </View>

        <Section
          title="Praticar agora"
          actionLabel="Ver tudo"
          onAction={() => router.push('/questoes')}>
          <Card padded={false} style={[styles.practicePanel, { borderColor: colors.border }]}>
            {PRACTICE_ACTIONS.map((item, index) => (
              <PressFeedback
                key={item.title}
                onPress={() => router.push(item.route)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.description}`}
                style={[
                  styles.practiceAction,
                  index > 0 && {
                    borderLeftColor: colors.border,
                    borderLeftWidth: StyleSheet.hairlineWidth,
                  },
                ]}>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.practiceIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={colors.primary}
                    aria-hidden={true}
                  />
                </View>
                <Text style={[styles.practiceTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.practiceDescription, { color: colors.textMuted }]}>
                  {item.description}
                </Text>
              </PressFeedback>
            ))}
          </Card>
        </Section>

        <Section title="Atividade recente">
          <RecentStudyCard
            activities={studyMomentum.recentActivities}
            onOpen={(route) => router.push(route)}
            onStart={() => router.push('/questoes')}
          />
        </Section>

        <Section title="Seu ritmo">
          <StudyMomentumCard
            momentum={studyMomentum}
            onGoalChange={setWeeklyQuestionGoal}
          />
        </Section>

        {focusConcurso && focusDeadline ? (
          <Section
            title="Minha meta"
            actionLabel={savedFocus ? 'Ver salvos' : 'Explorar'}
            onAction={() => router.push(savedFocus ? '/concursos/salvos' : '/concursos')}>
            <Card
              onPress={() => router.push(`/concurso/${focusConcurso.id}`)}
              accessibilityLabel={`Abrir meta ${focusConcurso.shortName}`}
              style={[styles.goalCard, { borderColor: colors.borderStrong }]}>
              <View style={[styles.goalAccent, { backgroundColor: colors.primary }]} />
              <View style={styles.goalTopline}>
                <Text style={[styles.goalEyebrow, { color: colors.primary }]}>EM FOCO</Text>
                <Badge
                  label={focusDeadline.label}
                  tone={focusDeadline.tone}
                  icon={focusDeadline.icon}
                />
              </View>
              <View style={styles.goalMain}>
                <View style={[styles.goalIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons
                    name={(focusConcurso.icon as keyof typeof Ionicons.glyphMap) ?? 'briefcase-outline'}
                    size={22}
                    color={focusConcurso.iconColor ?? colors.primary}
                  />
                </View>
                <View style={styles.goalCopy}>
                  <Text style={[styles.goalTitle, { color: colors.text }]} numberOfLines={2}>
                    {focusConcurso.shortName} · {focusConcurso.title}
                  </Text>
                  <Text style={[styles.goalMeta, { color: colors.textMuted }]}>
                    Até {formatSalaryShort(focusConcurso.salaryMax)}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={19} color={colors.primary} />
              </View>
            </Card>
          </Section>
        ) : targetRole ? (
          <Section title="Minha meta" actionLabel="Explorar" onAction={() => router.push('/concursos')}>
            <Card
              onPress={() => router.push('/concursos')}
              accessibilityLabel={`Explorar concursos para ${targetRole}`}
              style={[styles.roleCard, { borderColor: colors.borderStrong }]}>
              <View style={[styles.goalIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="flag-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.goalCopy}>
                <Text style={[styles.goalEyebrow, { color: colors.primary }]}>CARGO-ALVO</Text>
                <Text style={[styles.goalTitle, { color: colors.text }]}>{targetRole}</Text>
              </View>
              <Ionicons name="arrow-forward" size={19} color={colors.primary} />
            </Card>
          </Section>
        ) : null}

        <Section title="Explorar">
          <Card padded={false} style={[styles.exploreCard, { borderColor: colors.border }]}>
            {EXPLORE_ACTIONS.map((item, index) => (
              <Pressable
                key={item.title}
                onPress={() => router.push(item.route)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.description}`}
                style={({ pressed }) => [
                  styles.exploreRow,
                  index < EXPLORE_ACTIONS.length - 1 && {
                    borderBottomColor: colors.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                  pressed && styles.explorePressed,
                ]}>
                <View style={[styles.exploreIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.exploreMarker, { color: colors.primary }]}>{item.marker}</Text>
                </View>
                <View style={styles.exploreCopy}>
                  <Text style={[styles.exploreTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.exploreDescription, { color: colors.textMuted }]}>
                    {item.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>
            ))}
          </Card>
        </Section>
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
  practicePanel: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
  },
  practiceAction: {
    minWidth: 0,
    flex: 1,
    minHeight: 126,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  practiceIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceTitle: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  practiceDescription: { fontSize: FontSize.tiny, lineHeight: 16 },
  goalCard: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    gap: Spacing.md,
  },
  goalAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  goalTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  goalEyebrow: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  goalMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  goalIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCopy: { flex: 1, gap: 3 },
  goalTitle: { fontSize: FontSize.body, lineHeight: 20, fontWeight: FontWeight.bold },
  goalMeta: { fontSize: FontSize.small },
  roleCard: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  exploreCard: { overflow: 'hidden', borderWidth: 1 },
  exploreRow: {
    minHeight: 76,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  explorePressed: { opacity: 0.68 },
  exploreIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreMarker: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
  },
  exploreCopy: { flex: 1, gap: 2 },
  exploreTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  exploreDescription: { fontSize: FontSize.small, lineHeight: 18 },
  pressed: { opacity: 0.65 },
});
