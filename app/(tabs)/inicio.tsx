import Ionicons from '@/components/ui/app-icon';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Section } from '@/components/ui/section';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deadlineInfo, recommendConcursosForGoal, sortConcursos } from '@/lib/concursos';
import { formatPercent, formatSalaryShort } from '@/lib/format';
import { useApp } from '@/providers/app-provider';
import { useSimulation } from '@/providers/simulation-provider';
import { useConcursos } from '@/providers/concursos-provider';

type QuickLink = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: Href;
  palette: Record<'light' | 'dark', QuickLinkPalette>;
};

type QuickLinkPalette = {
  background: string;
  accent: string;
  iconBackground: string;
  subtitle: string;
};

const HOME_GRADIENTS = {
  continue: {
    light: ['#F3EEFF', '#EFF6FF'],
    dark: ['#1B1730', '#13243A'],
  },
  radar: {
    light: ['#EFF6FF', '#F0FDFA'],
    dark: ['#122338', '#102A2A'],
  },
  challenge: {
    light: ['#F5F3FF', '#EDE9FE'],
    dark: ['#1D1734', '#2A1F47'],
  },
} as const;

const QUICK_LINK_SHADOW = ['rgba(0, 0, 0, 0.06)', 'rgba(0, 0, 0, 0)'] as const;

const QUICK_LINKS: QuickLink[] = [
  {
    title: 'Trilhas de estudo',
    description: 'Avance por níveis conforme sua meta',
    icon: 'map-outline',
    route: '/trilhas',
    palette: {
      light: {
        background: '#3B82C4',
        accent: '#E8F3FF',
        iconBackground: 'rgba(255, 255, 255, 0.16)',
        subtitle: '#D8ECFF',
      },
      dark: {
        background: '#2F6FA8',
        accent: '#E8F3FF',
        iconBackground: 'rgba(255, 255, 255, 0.14)',
        subtitle: '#D8ECFF',
      },
    },
  },
  {
    title: 'Redação',
    description: 'Escolha um tema e pratique sua escrita',
    icon: 'create-outline',
    route: '/redacao',
    palette: {
      light: {
        background: '#3A9D6F',
        accent: '#E5FFF0',
        iconBackground: 'rgba(255, 255, 255, 0.16)',
        subtitle: '#D7F6E4',
      },
      dark: {
        background: '#2E7D59',
        accent: '#E5FFF0',
        iconBackground: 'rgba(255, 255, 255, 0.14)',
        subtitle: '#D7F6E4',
      },
    },
  },
  {
    title: 'Biblioteca',
    description: 'Em breve: audiobooks, anotações e flashcards',
    icon: 'library-outline',
    route: '/biblioteca',
    palette: {
      light: {
        background: '#B9794A',
        accent: '#FFF1E4',
        iconBackground: 'rgba(255, 255, 255, 0.16)',
        subtitle: '#F5DDC9',
      },
      dark: {
        background: '#925D3A',
        accent: '#FFF1E4',
        iconBackground: 'rgba(255, 255, 255, 0.14)',
        subtitle: '#F5DDC9',
      },
    },
  },
];

export default function HomeScreen() {
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const {
    profile,
    performance,
    isPremium,
    dailyQuestionLimit,
    dailyQuestionsAnswered,
    dailyQuestionsRemaining,
    favoriteQuestionIds,
    savedConcursos,
  } = useApp();
  const { session } = useSimulation();
  const { concursos } = useConcursos();

  const firstName = profile.name.trim().split(/\s+/)[0] || 'Estudante';
  const answeredInSimulation = session ? Object.keys(session.answers).length : 0;
  const simulationProgress = session?.questions.length
    ? (answeredInSimulation / session.questions.length) * 100
    : 0;
  const continueCard = session
    ? {
        label: session.status === 'completed' ? 'Seu último simulado' : 'Você parou aqui',
        title: session.status === 'completed' ? 'Revisar resultado' : 'Voltar ao simulado',
        description:
          session.status === 'completed'
            ? 'Confira seu desempenho e reveja as questões.'
            : `${answeredInSimulation} de ${session.questions.length} questões respondidas`,
        icon: session.status === 'completed' ? ('stats-chart-outline' as const) : ('play' as const),
        route:
          session.status === 'completed'
            ? ('/questoes/simulado/resultado' as Href)
            : ('/questoes/simulado' as Href),
        progress: session.status === 'completed' ? 100 : simulationProgress,
      }
    : {
        label: performance.total > 0 ? 'Continuar estudando' : 'Seu primeiro passo',
        title: performance.total > 0 ? 'Resolver questões' : 'Comece sua preparação',
        description:
          performance.total > 0
            ? `${performance.total} ${performance.total === 1 ? 'questão no histórico' : 'questões no histórico'}`
            : 'Escolha uma disciplina para começar.',
        icon: 'reader-outline' as const,
        route: '/questoes' as Href,
        progress: undefined,
      };

  const progressTitle = isPremium ? 'Desempenho geral' : 'Questões de hoje';
  const progressValue = isPremium
    ? formatPercent(performance.accuracy)
    : `${dailyQuestionsAnswered}/${dailyQuestionLimit}`;
  const progressDescription = isPremium
    ? `${performance.total} respondidas`
    : `${dailyQuestionsRemaining} disponíveis no Plano Básico`;
  const progressPercent = isPremium
    ? performance.accuracy
    : (dailyQuestionsAnswered / dailyQuestionLimit) * 100;
  const targetRole = profile.targetRole?.trim() ?? '';
  const savedActiveConcursos = sortConcursos(
    concursos.filter(
      (concurso) =>
        savedConcursos.includes(concurso.id) && concurso.status !== 'encerrado'
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
  const radarConcurso =
    savedFocus ??
    recommendedConcursos.find((concurso) => concurso.status === 'aberto') ??
    recommendedConcursos[0];
  const radarDeadline = radarConcurso ? deadlineInfo(radarConcurso) : null;
  const radarUsesSavedConcurso = Boolean(savedFocus);
  const challengeContext = savedFocus?.shortName ?? targetRole;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={`Olá, ${firstName}`}
        subtitle={profile.targetRole ? profile.targetRole : 'Seu espaço de estudo'}
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
        <Card
          onPress={() => router.push(continueCard.route)}
          accessibilityLabel={continueCard.title}
          padded={false}
          style={[styles.gradientShell, { borderColor: colors.borderStrong }]}>
          <LinearGradient
            colors={HOME_GRADIENTS.continue[scheme]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.continueCard}>
            <View style={styles.continueTop}>
              <View style={[styles.continueIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={continueCard.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.continueText}>
                <View style={styles.continueLabelRow}>
                  <Text style={[styles.continueLabel, { color: colors.primary }]}>{continueCard.label}</Text>
                  <View style={[styles.continueMarker, { backgroundColor: colors.primary }]} />
                </View>
                <Text style={[styles.continueTitle, { color: colors.text }]}>{continueCard.title}</Text>
                <Text style={[styles.continueDescription, { color: colors.textMuted }]}>{continueCard.description}</Text>
              </View>
              <Ionicons name="arrow-forward" size={19} color={colors.textSubtle} />
            </View>
            {continueCard.progress !== undefined ? (
              <ProgressBar value={continueCard.progress} height={5} label={`Progresso: ${Math.round(continueCard.progress)}%`} />
            ) : null}
          </LinearGradient>
        </Card>

        <View style={[styles.progressCard, { backgroundColor: colors.surfaceAlt }]}>
          <View style={styles.progressHeader}>
            <View style={styles.progressCopy}>
              <Text style={[styles.progressTitle, { color: colors.text }]}>{progressTitle}</Text>
              <Text style={[styles.progressDescription, { color: colors.textMuted }]}>{progressDescription}</Text>
            </View>
            <Text style={[styles.progressValue, { color: colors.primary }]}>{progressValue}</Text>
          </View>
          <ProgressBar value={progressPercent} height={5} label={progressTitle} />
        </View>

        <Section title={isPremium ? 'Revisar agora' : 'Praticar agora'}>
          <Card padded={false} style={styles.reviewCard}>
            {isPremium ? (
              <>
                <ListRow
                  icon={performance.wrong > 0 ? 'refresh-outline' : 'reader-outline'}
                  label={performance.wrong > 0 ? 'Revisar erros' : 'Começar uma revisão'}
                  description={
                    performance.wrong > 0
                      ? `${performance.wrong} ${performance.wrong === 1 ? 'questão para rever' : 'questões para rever'}`
                      : 'Resolva questões para montar sua revisão'
                  }
                  tone={performance.wrong > 0 ? 'danger' : 'primary'}
                  onPress={() =>
                    router.push(
                      performance.wrong > 0
                        ? '/perfil/desempenho/questoes?tipo=wrong'
                        : '/questoes'
                    )
                  }
                />
                <ListRow
                  icon="bookmark-outline"
                  label="Questões favoritas"
                  description={
                    favoriteQuestionIds.length > 0
                      ? `${favoriteQuestionIds.length} ${
                          favoriteQuestionIds.length === 1 ? 'questão salva' : 'questões salvas'
                        }`
                      : 'Nenhuma questão salva ainda'
                  }
                  tone="primary"
                  onPress={() => router.push('/perfil/desempenho/questoes?tipo=favorites')}
                  isLast
                />
              </>
            ) : (
              <ListRow
                icon="reader-outline"
                label="Continuar resolvendo"
                description="Pratique questões e acompanhe sua evolução"
                tone="primary"
                onPress={() => router.push('/questoes')}
                isLast
              />
            )}
          </Card>
        </Section>

        <Section title="Atalhos">
          <View style={styles.quickLinksGrid}>
            {QUICK_LINKS.map((item) => {
              const palette = item.palette[scheme];

              return (
                <Card
                  key={item.title}
                  onPress={() => router.push(item.route)}
                  accessibilityLabel={item.title}
                  padded={false}
                  style={[
                    styles.quickLinkCard,
                    { backgroundColor: palette.background, borderColor: 'transparent' },
                  ]}>
                  <View
                    style={[
                      styles.quickLinkContent,
                      { backgroundColor: palette.background },
                    ]}>
                    <LinearGradient
                      pointerEvents="none"
                      colors={QUICK_LINK_SHADOW}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View
                      style={[
                        styles.quickLinkIcon,
                        { backgroundColor: palette.iconBackground },
                      ]}>
                      <Ionicons name={item.icon} size={22} color={palette.accent} />
                    </View>
                    <View style={styles.quickLinkText}>
                      <Text style={[styles.quickLinkTitle, { color: '#FFFFFF' }]}>
                        {item.title}
                      </Text>
                      <Text
                        style={[styles.quickLinkDescription, { color: palette.subtitle }]}
                        numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={palette.accent} />
                  </View>
                </Card>
              );
            })}
          </View>
        </Section>

        {radarConcurso && radarDeadline ? (
          <Section
            title={radarUsesSavedConcurso ? 'Seu concurso em foco' : 'Radar da sua meta'}
            actionLabel={radarUsesSavedConcurso ? 'Ver salvos' : 'Ver todos'}
            onAction={() =>
              router.push(radarUsesSavedConcurso ? '/concursos/salvos' : '/concursos')
            }>
            <Card
              onPress={() => router.push(`/concurso/${radarConcurso.id}`)}
              accessibilityLabel={`Ver ${radarConcurso.shortName}`}
              padded={false}
              style={[styles.gradientShell, { borderColor: colors.borderStrong }]}>
              <LinearGradient
                colors={HOME_GRADIENTS.radar[scheme]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.radarCard}>
                <View
                  style={[
                    styles.radarIcon,
                    { backgroundColor: colors.primarySoft },
                  ]}>
                  <Ionicons
                    name={(radarConcurso.icon as keyof typeof Ionicons.glyphMap) ?? 'briefcase-outline'}
                    size={22}
                    color={radarConcurso.iconColor ?? colors.primary}
                  />
                </View>
                <View style={styles.radarContent}>
                  <Text style={[styles.radarMatch, { color: colors.primary }]}>
                    {radarUsesSavedConcurso
                      ? `${savedActiveConcursos.length} ${
                          savedActiveConcursos.length === 1
                            ? 'concurso salvo em acompanhamento'
                            : 'concursos salvos em acompanhamento'
                        }`
                      : `${recommendedConcursos.length} ${
                          recommendedConcursos.length === 1
                            ? 'oportunidade compatível'
                            : 'oportunidades compatíveis'
                        }`}
                  </Text>
                  <Text style={[styles.radarTitle, { color: colors.text }]} numberOfLines={2}>
                    {radarConcurso.shortName} · {radarConcurso.title}
                  </Text>
                  <View style={styles.radarMeta}>
                    <Badge
                      label={radarDeadline.label}
                      tone={radarDeadline.tone}
                      icon={radarDeadline.icon}
                    />
                    <Text style={[styles.radarSalary, { color: colors.textMuted }]}>
                      Até {formatSalaryShort(radarConcurso.salaryMax)}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </LinearGradient>
            </Card>
          </Section>
        ) : (
          <Section
            title="Radar da sua meta"
            actionLabel="Explorar"
            onAction={() => router.push('/concursos')}>
            <Card
              onPress={() => router.push('/meta')}
              accessibilityLabel="Escolher uma meta"
              padded={false}
              style={[styles.gradientShell, { borderColor: colors.borderStrong }]}>
              <LinearGradient
                colors={HOME_GRADIENTS.radar[scheme]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyRadarCard}>
                <View style={[styles.radarIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="flag-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.radarContent}>
                  <Text style={[styles.radarTitle, { color: colors.text }]}>Escolha uma meta</Text>
                  <Text style={[styles.emptyRadarDescription, { color: colors.textMuted }]}>
                    Receba editais e questões alinhados ao que você busca.
                  </Text>
                  <Text style={[styles.emptyRadarAction, { color: colors.primary }]}>
                    Configurar agora
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={19} color={colors.primary} />
              </LinearGradient>
            </Card>
          </Section>
        )}

        <Section title="Desafio rápido">
          <Card
            onPress={() => router.push('/questoes/desafio')}
            accessibilityLabel="Começar desafio rápido"
            padded={false}
            style={[styles.gradientShell, { borderColor: colors.borderStrong }]}>
            <LinearGradient
              colors={HOME_GRADIENTS.challenge[scheme]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.challengeCard}>
              <View style={[styles.challengeIcon, { backgroundColor: colors.primary }]}>
                <Ionicons name="flash" size={21} color={colors.onPrimary} />
              </View>
              <View style={styles.challengeContent}>
                <Text style={[styles.challengeEyebrow, { color: colors.primary }]}>5 MINUTOS</Text>
                <Text style={[styles.challengeTitle, { color: colors.text }]} numberOfLines={2}>
                  {challengeContext
                    ? `3 questões para ${challengeContext}`
                    : '3 questões de conteúdos variados'}
                </Text>
                <Text style={[styles.challengeDescription, { color: colors.textMuted }]}>
                  {savedFocus
                    ? 'Conteúdo do seu concurso em foco'
                    : targetRole
                      ? 'Conteúdo alinhado ao seu cargo'
                      : 'Uma seleção rápida para começar'}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={19} color={colors.primary} />
            </LinearGradient>
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
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  gradientShell: { overflow: 'hidden' },
  continueCard: { gap: Spacing.md, padding: Spacing.md },
  continueTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  continueIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { flex: 1, gap: 2 },
  continueLabelRow: { alignSelf: 'flex-start', gap: 3 },
  continueLabel: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.semibold,
  },
  continueMarker: { width: 22, height: 2 },
  continueTitle: {
    fontSize: FontSize.heading + 1,
    fontWeight: FontWeight.bold,
  },
  continueDescription: { fontSize: FontSize.small, lineHeight: 18 },
  progressCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 18,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  progressCopy: { flex: 1, gap: 2 },
  progressTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  progressDescription: { fontSize: FontSize.small, lineHeight: 18 },
  progressValue: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
  },
  reviewCard: { overflow: 'hidden' },
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  quickLinkCard: {
    flexBasis: 220,
    flexGrow: 1,
    padding: 2,
    borderWidth: 0,
    borderRadius: 18,
    overflow: 'hidden',
  },
  quickLinkContent: {
    minHeight: 116,
    padding: Spacing.lg,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    overflow: 'hidden',
  },
  quickLinkIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkText: { flex: 1, gap: 3 },
  quickLinkTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    textShadowColor: 'rgba(0, 0, 0, 0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  quickLinkDescription: {
    fontSize: FontSize.small,
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.14)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  radarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  radarIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarContent: { flex: 1, gap: 4 },
  radarMatch: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.semibold,
  },
  radarTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    lineHeight: 19,
  },
  radarMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  radarSalary: { fontSize: FontSize.tiny, fontWeight: FontWeight.medium },
  emptyRadarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  emptyRadarDescription: { fontSize: FontSize.small, lineHeight: 18 },
  emptyRadarAction: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  challengeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeContent: { flex: 1, gap: 2 },
  challengeEyebrow: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.7,
  },
  challengeTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  challengeDescription: { fontSize: FontSize.small, lineHeight: 18 },
  pressed: { opacity: 0.65 },
});
