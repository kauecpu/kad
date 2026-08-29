import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Ionicons from '@/components/ui/app-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { FeaturedCard } from '@/components/ui/featured-card';
import { KadCardArtwork } from '@/components/ui/kad-card-artwork';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SearchField } from '@/components/ui/search-field';
import { Section } from '@/components/ui/section';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { StackHeader } from '@/components/ui/stack-header';
import type { Tone } from '@/components/ui/tone';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { DISCIPLINES } from '@/data/disciplines';
import { CONCURSO_PACKS } from '@/data/exam-concursos';
import { useTheme } from '@/hooks/use-theme';
import { questionsForPack, recommendPackForGoal } from '@/lib/simulations';
import {
  filterTrailTracks,
  parseTrailSelection,
  resolveTrailSelection,
  trailLevelMetrics,
  trailMetrics,
  trailSelectionStorageKey,
  type TrailCatalog,
  type TrailMode,
} from '@/lib/trail-journey';
import { createTrailLevels, questionsForDisciplines, type TrailLevel } from '@/lib/trails';
import { useApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';
import { useQuestions } from '@/providers/questions-provider';
import type { AnswerRecord, Question } from '@/types';

type TrailTrack = {
  id: string;
  name: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  disciplines: string[];
  packId?: string;
  kind: 'concurso' | 'area' | 'discipline';
};

const MODE_OPTIONS: SegmentedOption<TrailMode>[] = [
  { value: 'concurso', label: 'Por concurso ou área' },
  { value: 'discipline', label: 'Por disciplina' },
];

const CONCURSO_TRACKS: TrailTrack[] = CONCURSO_PACKS.map((pack) => ({
  id: pack.id,
  name: pack.name,
  subtitle: pack.subtitle ?? `${pack.disciplines.length} disciplinas`,
  icon: pack.icon as keyof typeof Ionicons.glyphMap,
  color: pack.color,
  disciplines: pack.disciplines,
  packId: pack.id,
  kind: pack.kind,
}));

const DISCIPLINE_TRACKS: TrailTrack[] = DISCIPLINES.map((discipline) => ({
  id: discipline.name,
  name: discipline.name,
  subtitle: `${discipline.topics.length} assuntos`,
  icon: discipline.icon as keyof typeof Ionicons.glyphMap,
  color: discipline.color,
  disciplines: [discipline.name],
  kind: 'discipline',
}));

function questionsForTrack(track: TrailTrack, questions: Question[]) {
  const pack = track.packId
    ? CONCURSO_PACKS.find((item) => item.id === track.packId)
    : undefined;
  return pack
    ? questionsForPack(pack, questions)
    : questionsForDisciplines(questions, track.disciplines);
}

function availableLevelsForTrack(track: TrailTrack, questions: Question[]): TrailLevel[] {
  return createTrailLevels(questionsForTrack(track, questions)).filter(
    (level) => level.questions.length > 0,
  );
}

function levelState(level: TrailLevel, answers: Record<string, AnswerRecord>) {
  const metrics = trailLevelMetrics(level, answers);
  if (metrics.completed) {
    return {
      ...metrics,
      label: 'Concluído',
      icon: 'checkmark-circle' as const,
      tone: 'success' as Tone,
    };
  }
  if (metrics.answered > 0) {
    return {
      ...metrics,
      label: 'Em andamento',
      icon: 'play-circle-outline' as const,
      tone: 'warning' as Tone,
    };
  }
  return {
    ...metrics,
    label: 'Disponível',
    icon: 'ellipse-outline' as const,
    tone: 'accent' as Tone,
  };
}

export default function TrailsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { session, isGuest } = useAuth();
  const { answers, profile } = useApp();
  const { questions } = useQuestions();
  const trailCatalog = useMemo<TrailCatalog>(() => ({
    concurso: Object.fromEntries(
      CONCURSO_TRACKS.map((track) => [
        track.id,
        availableLevelsForTrack(track, questions).map((level) => level.number),
      ]),
    ),
    discipline: Object.fromEntries(
      DISCIPLINE_TRACKS.map((track) => [
        track.id,
        availableLevelsForTrack(track, questions).map((level) => level.number),
      ]),
    ),
  }), [questions]);
  const recommendedPack = useMemo(
    () => recommendPackForGoal(CONCURSO_PACKS, profile.targetRole),
    [profile.targetRole]
  );
  const ownerId = session?.user.id ?? (isGuest ? 'guest' : null);
  const storageKey = ownerId ? trailSelectionStorageKey(ownerId) : null;
  const isDesktop = width >= 900;

  const [mode, setMode] = useState<TrailMode>('concurso');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const [selectorOffset, setSelectorOffset] = useState(0);

  useEffect(() => {
    let active = true;
    setHydratedStorageKey(null);
    setMode('concurso');
    setSelectedTrackId('');
    setSelectedLevel(1);
    setSearchQuery('');

    if (!storageKey) {
      return () => {
        active = false;
      };
    }

    void (async () => {
      let stored = null;
      try {
        stored = parseTrailSelection(await AsyncStorage.getItem(storageKey));
      } catch {
        stored = null;
      }
      const initial = resolveTrailSelection({
        stored,
        recommendedTrackId: recommendedPack?.id,
        catalog: trailCatalog,
      });
      if (!active) return;
      if (initial) {
        setMode(initial.mode);
        setSelectedTrackId(initial.trackId);
        setSelectedLevel(initial.level);
      }
      setHydratedStorageKey(storageKey);
    })();

    return () => {
      active = false;
    };
  }, [recommendedPack?.id, storageKey, trailCatalog]);

  useEffect(() => {
    if (!storageKey || hydratedStorageKey !== storageKey) return;
    if (!selectedTrackId) {
      void AsyncStorage.removeItem(storageKey).catch(() => undefined);
      return;
    }
    void AsyncStorage.setItem(
      storageKey,
      JSON.stringify({ mode, trackId: selectedTrackId, level: selectedLevel })
    ).catch(() => undefined);
  }, [hydratedStorageKey, mode, selectedLevel, selectedTrackId, storageKey]);

  const tracks = mode === 'concurso' ? CONCURSO_TRACKS : DISCIPLINE_TRACKS;
  const track = tracks.find((item) => item.id === selectedTrackId);
  const visibleTracks = useMemo(
    () => filterTrailTracks(tracks, searchQuery),
    [searchQuery, tracks]
  );
  const levels = useMemo(
    () => (track ? availableLevelsForTrack(track, questions) : []),
    [questions, track],
  );
  const activeLevel = levels.find((level) => level.number === selectedLevel) ?? levels[0];
  const currentMetrics = useMemo(() => trailMetrics(levels, answers), [answers, levels]);
  const recommendedTrack = recommendedPack
    ? CONCURSO_TRACKS.find((item) => item.id === recommendedPack.id)
    : undefined;
  const heroTrack = recommendedTrack ?? track;
  const heroLevels = useMemo(
    () => (heroTrack ? availableLevelsForTrack(heroTrack, questions) : []),
    [heroTrack, questions]
  );
  const heroMetrics = useMemo(() => trailMetrics(heroLevels, answers), [answers, heroLevels]);
  const heroResumeLevel =
    heroLevels.find((level) => !trailLevelMetrics(level, answers).completed) ?? heroLevels[0];
  const heroIsRecommendation = Boolean(
    heroTrack && recommendedTrack && heroTrack.id === recommendedTrack.id,
  );

  const changeMode = (nextMode: TrailMode) => {
    const nextTrackId = nextMode === 'concurso' ? recommendedTrack?.id ?? '' : '';
    const nextLevels = nextTrackId ? trailCatalog[nextMode][nextTrackId] : undefined;
    setMode(nextMode);
    setSelectedTrackId(nextTrackId);
    setSelectedLevel(nextLevels?.[0] ?? 1);
    setSearchQuery('');
  };

  const selectTrack = (trackId: string) => {
    const nextLevels = trailCatalog[mode][trackId];
    setSelectedTrackId(trackId);
    setSelectedLevel(nextLevels?.[0] ?? 1);
    setSearchQuery('');
  };

  const practiceLevel = (targetTrack: TrailTrack, level: TrailLevel) => {
    router.push({
      pathname: '/questoes/trilha',
      params: {
        questionIds: level.questions.map((question) => question.id).join(','),
        trackName: targetTrack.name,
        level: String(level.number),
      },
    });
  };

  const startHeroTrail = () => {
    if (!heroTrack || !heroResumeLevel) {
      scrollRef.current?.scrollTo({ y: Math.max(0, selectorOffset - Spacing.md), animated: true });
      return;
    }
    const heroMode: TrailMode = heroTrack.kind === 'discipline' ? 'discipline' : 'concurso';
    setMode(heroMode);
    setSelectedTrackId(heroTrack.id);
    setSelectedLevel(heroResumeLevel.number);
    setSearchQuery('');
    practiceLevel(heroTrack, heroResumeLevel);
  };

  if (storageKey && hydratedStorageKey !== storageKey) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title="Trilhas de estudo" onBack={() => router.back()} center />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const trackType = track
    ? track.kind === 'discipline'
      ? 'Disciplina'
      : track.kind === 'area'
        ? 'Área'
        : 'Concurso'
    : undefined;
  const heroActionLabel = !heroTrack
    ? 'Escolher trilha'
    : heroMetrics.answered === 0
      ? 'Começar'
      : heroMetrics.answered === heroMetrics.total
        ? 'Revisar trilha'
        : 'Continuar';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Trilhas de estudo" onBack={() => router.back()} center />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons name="map-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.introText}>
            <Text style={[styles.introTitle, { color: colors.text }]}>Estude com uma sequência clara</Text>
            <Text style={[styles.introDescription, { color: colors.textMuted }]}>Escolha uma trilha, acompanhe o que já respondeu e veja seu desempenho sem misturar as duas métricas.</Text>
          </View>
        </View>

        <FeaturedCard
          icon={heroTrack?.icon ?? 'navigate-outline'}
          title={heroTrack?.name ?? 'Escolha sua primeira trilha'}
          description={
            heroTrack
              ? heroIsRecommendation && profile.targetRole
                ? `Esta trilha combina com sua meta de ${profile.targetRole}.`
                : `${heroMetrics.total} ${heroMetrics.total === 1 ? 'questão disponível' : 'questões disponíveis'} em ${heroLevels.length} ${heroLevels.length === 1 ? 'nível' : 'níveis'}.`
              : 'Escolha um concurso, uma área ou uma disciplina para começar.'
          }
          intensity="strong"
          visual="faceted"
          artwork={<KadCardArtwork />}
        >
          <View style={[styles.heroFooter, isDesktop && styles.heroFooterDesktop]}>
            {heroTrack ? (
              <View style={styles.heroMetrics}>
                <View style={styles.heroMetric}>
                  <Text style={[styles.heroMetricValue, { color: colors.text }]}>
                    {heroMetrics.answered}/{heroMetrics.total}
                  </Text>
                  <Text style={[styles.heroMetricLabel, { color: colors.textMuted }]}>respondidas</Text>
                </View>
                <View style={[styles.heroMetricDivider, { backgroundColor: colors.borderStrong }]} />
                <View style={styles.heroMetric}>
                  <Text style={[styles.heroMetricValue, { color: colors.text }]}>
                    {heroMetrics.answered > 0 ? `${Math.round(heroMetrics.accuracy)}%` : '—'}
                  </Text>
                  <Text style={[styles.heroMetricLabel, { color: colors.textMuted }]}>de acertos</Text>
                </View>
              </View>
            ) : null}

            <Button
              label={heroActionLabel}
              icon={heroTrack ? 'play' : 'arrow-down'}
              onPress={startHeroTrail}
              fullWidth={!isDesktop}
              style={isDesktop ? styles.heroButtonDesktop : undefined}
            />
          </View>
        </FeaturedCard>

        <View
          onLayout={(event) => setSelectorOffset(event.nativeEvent.layout.y)}
          style={[styles.workspace, isDesktop && styles.workspaceDesktop]}>
          <View style={[styles.selectorColumn, isDesktop && styles.selectorColumnDesktop]}>
            <Segmented options={MODE_OPTIONS} value={mode} onChange={changeMode} />

            <Section title={mode === 'concurso' ? 'Escolha o concurso ou área' : 'Escolha a disciplina'}>
              <SearchField
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={mode === 'concurso' ? 'Pesquisar concurso ou área' : 'Pesquisar disciplina'}
                accessibilityLabel={
                  mode === 'concurso'
                    ? 'Pesquisar concurso ou área da trilha'
                    : 'Pesquisar disciplina da trilha'
                }
              />
              {visibleTracks.length > 0 ? (
                isDesktop ? (
                  <View style={styles.trackSelectorDesktop}>
                    {visibleTracks.map((item) => (
                      <Chip
                        key={item.id}
                        label={item.name}
                        selected={item.id === track?.id}
                        icon={item.icon}
                        onPress={() => selectTrack(item.id)}
                      />
                    ))}
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.trackSelector}>
                    {visibleTracks.map((item) => (
                      <Chip
                        key={item.id}
                        label={item.name}
                        selected={item.id === track?.id}
                        icon={item.icon}
                        onPress={() => selectTrack(item.id)}
                      />
                    ))}
                  </ScrollView>
                )
              ) : (
                <View style={[styles.searchEmpty, { borderColor: colors.border }]}>
                  <Ionicons name="search-outline" size={18} color={colors.textSubtle} />
                  <Text style={[styles.searchEmptyText, { color: colors.textMuted }]}>Nenhuma trilha encontrada</Text>
                </View>
              )}
            </Section>

            {track && trackType ? (
              <Card style={styles.trackSummary}>
                <View style={styles.trackHeader}>
                  <View style={styles.trackIcon}>
                    <Ionicons name={track.icon} size={22} color={colors.primary} />
                  </View>
                  <View style={styles.trackText}>
                    <Text style={[styles.trackName, { color: colors.text }]}>{track.name}</Text>
                    <Text style={[styles.trackSubtitle, { color: colors.textMuted }]}>{track.subtitle}</Text>
                  </View>
                  <Badge label={trackType} tone="neutral" />
                </View>

                <View style={styles.summaryMetrics}>
                  <View style={styles.summaryMetric}>
                    <Text style={[styles.summaryMetricValue, { color: colors.primary }]}>
                      {currentMetrics.answered}/{currentMetrics.total}
                    </Text>
                    <Text style={[styles.summaryMetricLabel, { color: colors.textMuted }]}>questões respondidas</Text>
                  </View>
                  <View style={styles.summaryMetric}>
                    <Text style={[styles.summaryMetricValue, { color: colors.primary }]}>
                      {currentMetrics.answered > 0 ? `${Math.round(currentMetrics.accuracy)}%` : '—'}
                    </Text>
                    <Text style={[styles.summaryMetricLabel, { color: colors.textMuted }]}>percentual de acertos</Text>
                  </View>
                </View>
                <ProgressBar
                  value={currentMetrics.progress}
                  color={colors.primary}
                  label={`${currentMetrics.answered} de ${currentMetrics.total} questões respondidas em ${track.name}`}
                />
              </Card>
            ) : null}
          </View>

          <View style={styles.levelColumn}>
            <Section title={track ? 'Níveis disponíveis' : 'Escolha uma trilha'}>
              {!track ? (
                <Card style={styles.chooseState}>
                  <View style={[styles.chooseIcon, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name="navigate-outline" size={23} color={colors.primary} />
                  </View>
                  <Text style={[styles.chooseTitle, { color: colors.text }]}>Sua jornada começa pela escolha do foco</Text>
                  <Text style={[styles.chooseDescription, { color: colors.textMuted }]}>Use as opções ao lado para escolher um concurso, uma área ou uma disciplina.</Text>
                </Card>
              ) : (
                <View style={styles.levelList}>
                  {levels.map((level) => {
                    const selected = level.number === activeLevel?.number;
                    const state = levelState(level, answers);
                    const topicSummary =
                      level.topics.length > 1
                        ? `${level.topics[0]} + ${level.topics.length - 1}`
                        : level.topics[0] ?? 'Questões da trilha';
                    const actionLabel = state.completed
                      ? 'Revisar este nível'
                      : state.answered > 0
                        ? 'Continuar este nível'
                        : 'Praticar este nível';

                    return (
                      <Card
                        key={level.number}
                        padded={false}
                        style={[
                          styles.levelCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: selected ? colors.borderStrong : colors.border,
                          },
                        ]}>
                        <Pressable
                          onPress={() => setSelectedLevel(level.number)}
                          accessibilityRole="button"
                          accessibilityLabel={`Nível ${level.number}: ${level.title}. ${state.label}`}
                          accessibilityState={{ selected, expanded: selected, disabled: false }}
                          style={({ pressed }) => [styles.levelHeader, pressed && styles.pressed]}>
                          <View
                            style={[
                              styles.levelNumber,
                              {
                                backgroundColor: selected ? colors.primary : 'transparent',
                                borderColor: selected ? colors.primary : colors.borderStrong,
                              },
                            ]}>
                            <Text
                              style={[
                                styles.levelNumberText,
                                { color: selected ? colors.onPrimary : colors.textMuted },
                              ]}>
                              {level.number}
                            </Text>
                          </View>
                          <View style={styles.levelText}>
                            <Text style={[styles.levelTitle, { color: colors.text }]}>{level.title}</Text>
                            <Text style={[styles.levelTopic, { color: colors.textMuted }]} numberOfLines={1}>
                              {topicSummary}
                            </Text>
                          </View>
                          <Badge label={state.label} icon={state.icon} tone={state.tone} />
                          <Ionicons
                            name={selected ? 'chevron-up' : 'chevron-down'}
                            size={17}
                            color={colors.textSubtle}
                          />
                        </Pressable>

                        {selected ? (
                          <View style={[styles.levelDetail, { borderTopColor: colors.border }]}>
                            <Text style={[styles.detailDescription, { color: colors.textMuted }]}>
                              {level.description}
                            </Text>

                            <View style={styles.detailRows}>
                              <DetailRow
                                icon="book-outline"
                                label="Assuntos"
                                value={level.topics.join(' · ')}
                              />
                              <DetailRow
                                icon="checkbox-outline"
                                label="Progresso"
                                value={`${state.answered}/${state.total} respondidas`}
                              />
                              <DetailRow
                                icon="analytics-outline"
                                label="Desempenho"
                                value={state.answered > 0 ? `${Math.round(state.accuracy)}% de acertos` : 'Responda para calcular'}
                              />
                            </View>

                            <View style={[styles.tip, { borderColor: colors.border }]}>
                              <Ionicons name="bulb-outline" size={19} color={colors.warning} />
                              <View style={styles.tipText}>
                                <Text style={[styles.tipLabel, { color: colors.text }]}>Dica</Text>
                                <Text style={[styles.tipDescription, { color: colors.textMuted }]}>
                                  {level.tip}
                                </Text>
                              </View>
                            </View>

                            <Button
                              label={actionLabel}
                              icon="play"
                              onPress={() => practiceLevel(track, level)}
                              fullWidth
                            />
                          </View>
                        ) : null}
                      </Card>
                    );
                  })}
                </View>
              )}
            </Section>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.detailRowText}>
        <Text style={[styles.detailRowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.detailRowValue, { color: colors.textMuted }]}>{value}</Text>
      </View>
    </View>
  );
}

const TRAIL_CONTENT_MAX_WIDTH = 1120;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    width: '100%',
    maxWidth: TRAIL_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  intro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  introIcon: { width: 28, height: 46, alignItems: 'center', justifyContent: 'center' },
  introText: { flex: 1, gap: 3 },
  introTitle: { fontSize: FontSize.heading + 1, fontWeight: FontWeight.bold },
  introDescription: { fontSize: FontSize.small, lineHeight: 19, maxWidth: 720 },
  heroFooter: { gap: Spacing.lg },
  heroFooterDesktop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroMetrics: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroMetric: { minWidth: 80, gap: 2 },
  heroMetricValue: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  heroMetricLabel: { fontSize: FontSize.tiny },
  heroMetricDivider: { width: StyleSheet.hairlineWidth, height: 36 },
  heroButtonDesktop: { minWidth: 150 },
  workspace: { gap: Spacing.lg },
  workspaceDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  selectorColumn: { gap: Spacing.lg },
  selectorColumnDesktop: { width: 360 },
  levelColumn: { flex: 1, minWidth: 0 },
  trackSelector: { gap: Spacing.sm, paddingRight: Spacing.md },
  trackSelectorDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  searchEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  searchEmptyText: { fontSize: FontSize.small },
  trackSummary: { gap: Spacing.lg },
  trackHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  trackIcon: { width: 26, height: 44, alignItems: 'center', justifyContent: 'center' },
  trackText: { flex: 1, minWidth: 0, gap: 2 },
  trackName: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  trackSubtitle: { fontSize: FontSize.small, lineHeight: 18 },
  summaryMetrics: { flexDirection: 'row', gap: Spacing.lg },
  summaryMetric: { flex: 1, minWidth: 0, gap: 2 },
  summaryMetricValue: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  summaryMetricLabel: { fontSize: FontSize.tiny, lineHeight: 16 },
  chooseState: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxxl },
  chooseIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  chooseTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold, textAlign: 'center' },
  chooseDescription: { fontSize: FontSize.small, lineHeight: 19, textAlign: 'center', maxWidth: 360 },
  levelList: { gap: Spacing.sm },
  levelCard: { overflow: 'hidden' },
  levelHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  levelNumber: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumberText: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  levelText: { flex: 1, minWidth: 0, gap: 2 },
  levelTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  levelTopic: { fontSize: FontSize.tiny },
  levelDetail: {
    gap: Spacing.md,
    padding: Spacing.md,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailDescription: { fontSize: FontSize.body, lineHeight: 21 },
  detailRows: { gap: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  detailRowIcon: { width: 22, height: 34, alignItems: 'center', justifyContent: 'center' },
  detailRowText: { flex: 1, gap: 2 },
  detailRowLabel: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  detailRowValue: { fontSize: FontSize.small, lineHeight: 18 },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tipText: { flex: 1, gap: 2 },
  tipLabel: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  tipDescription: { fontSize: FontSize.small, lineHeight: 19 },
  pressed: { opacity: 0.7 },
});
