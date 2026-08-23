import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FeaturedCard } from '@/components/ui/featured-card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SearchField } from '@/components/ui/search-field';
import { Section } from '@/components/ui/section';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { CONCURSO_PACKS } from '@/data/exam-concursos';
import { useTheme } from '@/hooks/use-theme';
import { useOpenAppDrawer } from '@/hooks/use-open-app-drawer';
import { findStudyPackForConcurso } from '@/lib/concursos';
import { formatPercent } from '@/lib/format';
import {
  questionsForPack,
  recommendPackForGoal,
  simulationScore,
} from '@/lib/simulations';
import { useApp } from '@/providers/app-provider';
import { useSimulation } from '@/providers/simulation-provider';
import { useConcursos } from '@/providers/concursos-provider';
import { useQuestions } from '@/providers/questions-provider';
import type { ConcursoPack, SimulationSession } from '@/types';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function shortDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
      new Date(value)
    );
  } catch {
    return '--';
  }
}

export default function SimulationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const openMenu = useOpenAppDrawer();
  const { canUseSimulations, profile, savedConcursos, subscriptionLoading } = useApp();
  const { concursos } = useConcursos();
  const { session, history } = useSimulation();
  const { questions } = useQuestions();
  const [query, setQuery] = useState('');

  const recommendedPack = useMemo(() => {
    const byGoal = recommendPackForGoal(CONCURSO_PACKS, profile.targetRole);
    if (byGoal) return byGoal;

    for (const concursoId of savedConcursos) {
      const concurso = concursos.find((item) => item.id === concursoId);
      const match = concurso ? findStudyPackForConcurso(concurso, CONCURSO_PACKS) : undefined;
      if (match) return match;
    }
    return undefined;
  }, [concursos, profile.targetRole, savedConcursos]);

  const visiblePacks = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return CONCURSO_PACKS;
    return CONCURSO_PACKS.filter((pack) =>
      normalize(`${pack.name} ${pack.subtitle ?? ''}`).includes(term)
    );
  }, [query]);

  const exactPacks = visiblePacks.filter(
    (pack) => pack.kind === 'concurso' && (query || pack.id !== recommendedPack?.id)
  );
  const areaPacks = visiblePacks.filter(
    (pack) => pack.kind === 'area' && (query || pack.id !== recommendedPack?.id)
  );

  const openPack = (packId: string) => {
    router.push({ pathname: '/questoes/simulado/configurar', params: { packId } });
  };

  const openPlans = () => router.push('/perfil/planos');

  const renderPack = (pack: ConcursoPack, featured = false) => {
    const packQuestions = questionsForPack(pack, questions);
    const disciplineCount = new Set(packQuestions.map((question) => question.discipline)).size;
    const attempts = history.filter((item) => item.config.packId === pack.id);
    const latest = attempts[0];
    const score = latest ? simulationScore(latest, questions) : undefined;
    const disabled = packQuestions.length === 0;
    const locked = !canUseSimulations;

    return (
      <Card
        key={pack.id}
        onPress={
          disabled || subscriptionLoading ? undefined : locked ? openPlans : () => openPack(pack.id)
        }
        accessibilityLabel={
          subscriptionLoading
            ? `${pack.name}. Verificando seu plano`
            : locked
              ? `${pack.name}. Disponível nos planos KAD`
              : `Montar simulado para ${pack.name}`
        }
        style={[
          styles.packCard,
          featured && { borderColor: colors.borderStrong },
          disabled && styles.disabled,
        ]}>
        <View style={styles.packIcon}>
          <Ionicons
            name={(pack.icon as keyof typeof Ionicons.glyphMap) ?? 'briefcase-outline'}
            size={22}
            color={colors.primary}
          />
        </View>

        <View style={styles.packBody}>
          <View style={styles.packTitleRow}>
            <Text style={[styles.packName, { color: colors.text }]} numberOfLines={2}>
              {pack.name}
            </Text>
            {featured ? <Badge label="Recomendado" tone="accent" /> : null}
            {locked && !disabled ? (
              <Badge label="Planos KAD" tone="warning" icon="lock-closed" />
            ) : null}
          </View>
          <Text style={[styles.packMeta, { color: colors.textMuted }]} numberOfLines={2}>
            {disabled
              ? 'Questões em breve'
              : `${pack.subtitle ? `${pack.subtitle} · ` : ''}${packQuestions.length} ${packQuestions.length === 1 ? 'questão' : 'questões'} · ${disciplineCount} ${disciplineCount === 1 ? 'disciplina' : 'disciplinas'}`}
          </Text>
          {!disabled ? (
            <View style={styles.progressRow}>
              <Ionicons
                name={latest ? 'stats-chart-outline' : 'ellipse-outline'}
                size={14}
                color={latest ? colors.primary : colors.textSubtle}
              />
              <Text
                style={[
                  styles.progressText,
                  { color: latest ? colors.primary : colors.textSubtle },
                ]}>
                {score
                  ? `Último resultado: ${formatPercent(score.accuracy)}`
                  : 'Ainda não realizado'}
              </Text>
            </View>
          ) : null}
        </View>

        {!disabled ? (
          <Ionicons
            name={locked ? 'lock-closed-outline' : 'chevron-forward'}
            size={18}
            color={colors.textSubtle}
          />
        ) : null}
      </Card>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        onMenu={openMenu}
        title="Simulados"
        subtitle="Monte provas, controle o tempo e acompanhe sua evolução"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]}
        showsVerticalScrollIndicator={false}>
        {session ? (
          <Pressable
            disabled={subscriptionLoading}
            onPress={() =>
              canUseSimulations
                ? router.push(
                    session.status === 'completed'
                      ? '/questoes/simulado/resultado'
                      : '/questoes/simulado'
                  )
                : openPlans()
            }
            accessibilityRole="button"
            accessibilityLabel={
              subscriptionLoading
                ? 'Verificando seu plano para acessar o simulado salvo'
                : canUseSimulations
                  ? session.status === 'completed'
                    ? 'Ver resultado do simulado'
                    : 'Continuar simulado'
                  : 'Conhecer planos para acessar o simulado salvo'
            }
            style={({ pressed }) => [
            styles.resumeCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}>
            <View style={styles.resumeIcon}>
              <Ionicons
                name={session.status === 'completed' ? 'stats-chart' : 'play'}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.resumeBody}>
              <Text style={[styles.resumeTitle, { color: colors.text }]}>
                {session.status === 'completed' ? 'Seu último resultado' : 'Continuar simulado'}
              </Text>
              <Text style={[styles.resumeDescription, { color: colors.textMuted }]}>
                {session.status === 'completed'
                  ? `${formatPercent(simulationScore(session, questions).accuracy)} de aproveitamento · toque para revisar`
                  : `${Object.keys(session.answers).length} de ${session.questions.length} questões respondidas`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.primary} />
          </Pressable>
        ) : null}

        <FeaturedCard
          disabled={subscriptionLoading}
          onPress={
            canUseSimulations ? () => router.push('/questoes/simulado/configurar') : openPlans
          }
          accessibilityLabel={
            subscriptionLoading
              ? 'Verificando seu plano para montar simulados'
              : canUseSimulations
                ? 'Montar simulado personalizado'
                : 'Conhecer planos com simulados personalizados'
          }
          icon="options"
          title="Monte seu simulado"
          description="Escolha conteúdo, quantidade de questões e tempo de prova."
          accessory={(
            <Badge
              label={
                subscriptionLoading
                  ? 'Verificando plano'
                  : canUseSimulations
                    ? 'Incluído no plano'
                    : 'Planos KAD'
              }
              icon={
                subscriptionLoading
                  ? 'time-outline'
                  : canUseSimulations
                    ? 'checkmark-circle'
                    : 'lock-closed'
              }
              tone={canUseSimulations ? 'success' : 'warning'}
            />
          )}
          actionLabel={
            subscriptionLoading
              ? 'Aguarde um instante'
              : canUseSimulations
                ? 'Configurar prova'
                : 'Conhecer planos'
          }
          compact
        />

        {!query && recommendedPack ? (
          <Section title={profile.targetRole ? 'Para sua meta' : 'Para você'}>
            {renderPack(recommendedPack, true)}
          </Section>
        ) : null}

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar concurso ou área"
          accessibilityLabel="Buscar simulados por concurso ou área"
        />

        {exactPacks.length > 0 ? (
          <Section title="Por concurso">
            <View style={styles.packList}>{exactPacks.map((pack) => renderPack(pack))}</View>
          </Section>
        ) : null}

        {areaPacks.length > 0 ? (
          <Section title="Por área">
            <View style={styles.packList}>{areaPacks.map((pack) => renderPack(pack))}</View>
          </Section>
        ) : null}

        {exactPacks.length === 0 && areaPacks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={28} color={colors.textSubtle} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum simulado encontrado</Text>
            <Text style={[styles.emptyDescription, { color: colors.textMuted }]}>Tente buscar por outro concurso ou área.</Text>
          </View>
        ) : null}

        {history.length > 0 && !query ? (
          <Section title="Histórico recente">
            <Card padded={false} style={styles.historyCard}>
              {history.slice(0, 3).map((item, index) => (
                <HistoryRow
                  key={item.id}
                  session={item}
                  isLast={index === Math.min(history.length, 3) - 1}
                />
              ))}
            </Card>
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}

function HistoryRow({ session, isLast }: { session: SimulationSession; isLast: boolean }) {
  const { colors } = useTheme();
  const { questions } = useQuestions();
  const pack = CONCURSO_PACKS.find((item) => item.id === session.config.packId);
  const score = simulationScore(session, questions);
  return (
    <View
      style={[
        styles.historyRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}>
      <View style={styles.historyIcon}>
        <Ionicons name="stats-chart-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.historyBody}>
        <Text style={[styles.historyName, { color: colors.text }]} numberOfLines={1}>
          {pack?.name ?? 'Simulado personalizado'}
        </Text>
        <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
          {score.correct} de {score.total} acertos · {shortDate(session.completedAt ?? session.createdAt)}
        </Text>
      </View>
      <Text style={[styles.historyScore, { color: colors.primary }]}>
        {formatPercent(score.accuracy)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  resumeIcon: {
    width: 24,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBody: { flex: 1, gap: 2 },
  resumeTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  resumeDescription: { fontSize: FontSize.small, lineHeight: 18 },
  packList: { gap: Spacing.sm + 2 },
  packCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  packIcon: {
    width: 24,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packBody: { flex: 1, gap: 3 },
  packTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  packName: { flexShrink: 1, fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  packMeta: { fontSize: FontSize.small, lineHeight: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  progressText: { fontSize: FontSize.tiny, fontWeight: FontWeight.semibold },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
  emptyState: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xxl },
  emptyTitle: { marginTop: Spacing.xs, fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  emptyDescription: { fontSize: FontSize.small, textAlign: 'center' },
  historyCard: { overflow: 'hidden' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  historyIcon: {
    width: 20,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBody: { flex: 1, gap: 2 },
  historyName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  historyMeta: { fontSize: FontSize.tiny },
  historyScore: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
});
