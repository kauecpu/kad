import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SearchField } from '@/components/ui/search-field';
import { Section } from '@/components/ui/section';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { StackHeader } from '@/components/ui/stack-header';
import type { Tone } from '@/components/ui/tone';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { DISCIPLINES } from '@/data/disciplines';
import { CONCURSO_PACKS } from '@/data/exam-concursos';
import { QUESTIONS } from '@/data/questions';
import { useTheme } from '@/hooks/use-theme';
import { questionsForPack, recommendPackForGoal } from '@/lib/simulations';
import { normalizeSearchText } from '@/lib/text';
import { createTrailLevels, questionsForDisciplines, type TrailLevel } from '@/lib/trails';
import { useApp } from '@/providers/app-provider';
import type { AnswerRecord } from '@/types';

type TrailMode = 'concurso' | 'discipline';

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

function recommendedDiscipline(answers: Record<string, AnswerRecord>): string {
  const grouped = new Map<string, { total: number; correct: number }>();
  for (const question of QUESTIONS) {
    const answer = answers[question.id];
    if (!answer) continue;
    const current = grouped.get(question.discipline) ?? { total: 0, correct: 0 };
    grouped.set(question.discipline, {
      total: current.total + 1,
      correct: current.correct + (answer.isCorrect ? 1 : 0),
    });
  }

  return (
    Array.from(grouped.entries())
      .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total || b.total - a.total)[0]?.[0] ??
    DISCIPLINE_TRACKS[0]?.id ??
    ''
  );
}

function levelState(level: TrailLevel, answers: Record<string, AnswerRecord>) {
  if (level.questions.length === 0) {
    return {
      label: 'Em preparação',
      icon: 'time-outline' as const,
      tone: 'neutral' as Tone,
      answered: 0,
    };
  }

  const answered = level.questions.filter((question) => answers[question.id]).length;
  if (answered === level.questions.length) {
    return {
      label: 'Concluído',
      icon: 'checkmark-circle' as const,
      tone: 'success' as Tone,
      answered,
    };
  }
  if (answered > 0) {
    return {
      label: 'Em andamento',
      icon: 'play-circle-outline' as const,
      tone: 'warning' as Tone,
      answered,
    };
  }
  return {
    label: 'Disponível',
    icon: 'ellipse-outline' as const,
    tone: 'accent' as Tone,
    answered,
  };
}

export default function TrailsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { answers, profile } = useApp();
  const initialPack = recommendPackForGoal(CONCURSO_PACKS, profile.targetRole) ?? CONCURSO_PACKS[0];
  const [mode, setMode] = useState<TrailMode>('concurso');
  const [selectedTrackId, setSelectedTrackId] = useState(initialPack?.id ?? '');
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const tracks = mode === 'concurso' ? CONCURSO_TRACKS : DISCIPLINE_TRACKS;
  const track = tracks.find((item) => item.id === selectedTrackId) ?? tracks[0];
  const visibleTracks = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    if (!query) return tracks;
    return tracks.filter((item) => normalizeSearchText(item.name).includes(query));
  }, [searchQuery, tracks]);

  const trailQuestions = useMemo(() => {
    if (!track) return [];
    const pack = track.packId
      ? CONCURSO_PACKS.find((item) => item.id === track.packId)
      : undefined;
    return pack
      ? questionsForPack(pack)
      : questionsForDisciplines(QUESTIONS, track.disciplines);
  }, [track]);
  const levels = useMemo(() => createTrailLevels(trailQuestions), [trailQuestions]);
  const activeLevel = levels[selectedLevel - 1] ?? levels[0];
  const levelsWithActivity = levels.filter((level) => level.questions.length > 0);
  const completedLevels = levelsWithActivity.filter(
    (level) => levelState(level, answers).label === 'Concluído'
  ).length;
  const progress = levelsWithActivity.length > 0
    ? (completedLevels / levelsWithActivity.length) * 100
    : 0;

  const changeMode = (nextMode: TrailMode) => {
    setMode(nextMode);
    setSelectedTrackId(
      nextMode === 'concurso'
        ? initialPack?.id ?? CONCURSO_TRACKS[0]?.id ?? ''
        : recommendedDiscipline(answers)
    );
    setSelectedLevel(1);
    setSearchQuery('');
  };

  const changeSearch = (value: string) => {
    setSearchQuery(value);
    const query = normalizeSearchText(value);
    if (!query) return;
    const firstMatch = tracks.find((item) => normalizeSearchText(item.name).includes(query));
    if (firstMatch && firstMatch.id !== selectedTrackId) {
      setSelectedTrackId(firstMatch.id);
      setSelectedLevel(1);
    }
  };

  const selectTrack = (trackId: string) => {
    setSelectedTrackId(trackId);
    setSelectedLevel(1);
  };

  const practiceLevel = (level: TrailLevel) => {
    if (!track || level.questions.length === 0) return;
    router.push({
      pathname: '/questoes/trilha',
      params: {
        questionIds: level.questions.map((question) => question.id).join(','),
        trackName: track.name,
        level: String(level.number),
      },
    });
  };

  if (!track || !activeLevel) return null;

  const trackType =
    track.kind === 'discipline' ? 'Disciplina' : track.kind === 'area' ? 'Área' : 'Concurso';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Trilhas de estudo" onBack={() => router.back()} center />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons name="map-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.introText}>
            <Text style={[styles.introTitle, { color: colors.text }]}>Escolha por onde começar</Text>
            <Text style={[styles.introDescription, { color: colors.textMuted }]}>Avance do iniciante ao avançado ou comece diretamente no nível que combina com você.</Text>
          </View>
        </View>

        <Segmented options={MODE_OPTIONS} value={mode} onChange={changeMode} />

        <Section title={mode === 'concurso' ? 'Escolha o concurso ou área' : 'Escolha a disciplina'}>
          <SearchField
            value={searchQuery}
            onChangeText={changeSearch}
            placeholder={mode === 'concurso' ? 'Pesquisar concurso ou área' : 'Pesquisar disciplina'}
            accessibilityLabel={
              mode === 'concurso'
                ? 'Pesquisar concurso ou área da trilha'
                : 'Pesquisar disciplina da trilha'
            }
          />
          {visibleTracks.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trackSelector}>
              {visibleTracks.map((item) => (
                <Chip
                  key={item.id}
                  label={item.name}
                  selected={item.id === track.id}
                  icon={item.icon}
                  onPress={() => selectTrack(item.id)}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.searchEmpty, { borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.textSubtle} />
              <Text style={[styles.searchEmptyText, { color: colors.textMuted }]}>Nenhuma trilha encontrada</Text>
            </View>
          )}
        </Section>

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
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Progresso da trilha</Text>
            <View style={styles.progressMetric}>
              <Text style={[styles.progressValue, { color: colors.primary }]}>
                {completedLevels}/{levelsWithActivity.length}
              </Text>
              <Text style={[styles.progressUnit, { color: colors.textSubtle }]}>níveis</Text>
            </View>
          </View>
          <ProgressBar value={progress} color={colors.primary} label={`Progresso em ${track.name}`} />
        </Card>

        <Section title="Escolha o nível">
          <View style={styles.levelList}>
            {levels.map((level) => {
              const selected = level.number === activeLevel.number;
              const state = levelState(level, answers);
              const topicSummary =
                level.questions.length === 0
                  ? 'Atividade em preparação'
                  : level.topics.length > 1
                    ? `${level.topics[0]} + ${level.topics.length - 1}`
                    : level.topics[0] ?? 'Questões da trilha';

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
                    accessibilityState={{ selected }}
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
                        {level.questions.length > 0
                          ? level.description
                          : 'Este nível já está estruturado e receberá atividades quando o conteúdo for cadastrado.'}
                      </Text>

                      <View style={styles.detailRows}>
                        <DetailRow
                          icon="book-outline"
                          label="Assuntos"
                          value={level.topics.join(' · ') || 'Conteúdo em preparação'}
                        />
                        <DetailRow
                          icon="checkbox-outline"
                          label="Atividade"
                          value={
                            level.questions.length > 0
                              ? `${level.questions.length} ${level.questions.length === 1 ? 'questão para praticar' : 'questões para praticar'}`
                              : 'Nenhuma atividade cadastrada neste nível'
                          }
                        />
                      </View>

                      {level.questions.length > 0 ? (
                        <View
                          style={[
                            styles.tip,
                            { borderColor: colors.border },
                          ]}>
                          <Ionicons name="bulb-outline" size={19} color={colors.warning} />
                          <View style={styles.tipText}>
                            <Text style={[styles.tipLabel, { color: colors.text }]}>Dica</Text>
                            <Text style={[styles.tipDescription, { color: colors.textMuted }]}>
                              {level.tip}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      <Button
                        label={
                          level.questions.length > 0
                            ? 'Praticar este nível'
                            : 'Disponível em breve'
                        }
                        icon={level.questions.length > 0 ? 'play' : 'time-outline'}
                        onPress={() => practiceLevel(level)}
                        disabled={level.questions.length === 0}
                        fullWidth
                      />
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        </Section>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  intro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  introIcon: {
    width: 28,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: { flex: 1, gap: 3 },
  introTitle: {
    fontSize: FontSize.heading + 1,
    fontWeight: FontWeight.bold,
  },
  introDescription: { fontSize: FontSize.small, lineHeight: 19 },
  trackSelector: { gap: Spacing.sm, paddingRight: Spacing.md },
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
  trackSummary: { gap: Spacing.md },
  trackHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  trackIcon: {
    width: 26,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackText: { flex: 1, minWidth: 0, gap: 2 },
  trackName: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  trackSubtitle: { fontSize: FontSize.small, lineHeight: 18 },
  progressHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.md },
  progressLabel: { fontSize: FontSize.small },
  progressMetric: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  progressValue: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  progressUnit: { fontSize: FontSize.tiny },
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
  detailRowIcon: {
    width: 22,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
