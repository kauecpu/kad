import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { DISCIPLINES } from '@/data/disciplines';
import { CONCURSO_PACKS } from '@/data/exam-concursos';
import { QUESTIONS } from '@/data/questions';
import { useTheme } from '@/hooks/use-theme';
import { formatPercent } from '@/lib/format';
import { useApp } from '@/providers/app-provider';
import type { ConcursoPack } from '@/types';

type StudyMode = 'discipline' | 'concurso';

const STUDY_OPTIONS: SegmentedOption<StudyMode>[] = [
  { value: 'discipline', label: 'Por disciplina' },
  { value: 'concurso', label: 'Por concurso' },
];

type DisciplineStat = {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  topicsWithQuestions: number;
  total: number;
  answered: number;
  correct: number;
};

type StudyItem =
  | { kind: 'discipline'; value: DisciplineStat }
  | { kind: 'concurso'; value: ConcursoPack };

export default function QuestionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    answers,
    canViewStatistics,
    dailyQuestionLimit,
    dailyQuestionsRemaining,
    performance,
  } = useApp();
  const [studyMode, setStudyMode] = useState<StudyMode>('discipline');

  const disciplines = useMemo<DisciplineStat[]>(() => {
    return DISCIPLINES.map((discipline) => {
      const questions = QUESTIONS.filter((q) => q.discipline === discipline.name);
      const answered = questions.filter((q) => answers[q.id]);
      const correct = answered.filter((q) => answers[q.id]?.isCorrect).length;
      const topicsWithQuestions = discipline.topics.filter((topic) =>
        questions.some((q) => q.topic === topic)
      ).length;

      return {
        name: discipline.name,
        icon: (discipline.icon as keyof typeof Ionicons.glyphMap) ?? 'help-circle-outline',
        color: discipline.color,
        topicsWithQuestions,
        total: questions.length,
        answered: answered.length,
        correct,
      };
    });
  }, [answers]);

  const studyItems = useMemo<StudyItem[]>(
    () =>
      studyMode === 'discipline'
        ? disciplines.map((value) => ({ kind: 'discipline' as const, value }))
        : CONCURSO_PACKS.map((value) => ({ kind: 'concurso' as const, value })),
    [disciplines, studyMode]
  );

  const renderDiscipline = ({ item }: { item: DisciplineStat }) => {
    const progress = item.total > 0 ? (item.answered / item.total) * 100 : 0;
    const accuracy = item.answered > 0 ? (item.correct / item.answered) * 100 : 0;
    const disabled = item.total === 0;

    return (
      <Card
        onPress={
          disabled
            ? undefined
            : () =>
                router.push({
                  pathname: '/questoes/[discipline]',
                  params: { discipline: item.name },
                })
        }
        accessibilityLabel={`Abrir assuntos de ${item.name}`}
        style={[styles.card, disabled && { opacity: 0.55 }]}>
        <View style={styles.iconWrapper}>
          <Ionicons name={item.icon} size={20} color={colors.primary} />
        </View>

        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={2}>
            {disabled
              ? 'Questões em breve'
              : `${item.total} ${item.total === 1 ? 'questão' : 'questões'} · ${item.topicsWithQuestions} ${item.topicsWithQuestions === 1 ? 'assunto' : 'assuntos'}` +
                (canViewStatistics && item.answered > 0
                  ? ` · ${formatPercent(accuracy)} de acerto`
                  : '')}
          </Text>
          {!disabled && canViewStatistics ? (
            <ProgressBar value={progress} label={`Progresso em ${item.name}`} />
          ) : null}
        </View>

        {!disabled ? <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} /> : null}
      </Card>
    );
  };

  const renderConcurso = (pack: ConcursoPack) => {
    const questions = QUESTIONS.filter((question) =>
      pack.disciplines.includes(question.discipline)
    );
    const answered = questions.filter((question) => answers[question.id]);
    const correct = answered.filter((question) => answers[question.id]?.isCorrect).length;
    const accuracy = answered.length > 0 ? (correct / answered.length) * 100 : 0;
    const disabled = questions.length === 0;

    return (
      <Card
        onPress={
          disabled
            ? undefined
            : () =>
                router.push({
                  pathname: '/questoes/concurso/[id]',
                  params: { id: pack.id },
                })
        }
        accessibilityLabel={`Estudar questões de ${pack.name}`}
        style={[styles.card, disabled && { opacity: 0.55 }]}>
        <View style={styles.iconWrapper}>
          <Ionicons
            name={(pack.icon as keyof typeof Ionicons.glyphMap) ?? 'briefcase-outline'}
            size={20}
            color={colors.primary}
          />
        </View>

        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {pack.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={2}>
            {disabled
              ? 'Questões em breve'
              : `${pack.subtitle ? `${pack.subtitle} · ` : ''}${questions.length} questões · ${pack.disciplines.length} disciplinas` +
                (canViewStatistics && answered.length > 0
                  ? ` · ${formatPercent(accuracy)} de acerto`
                  : '')}
          </Text>
        </View>

        {!disabled ? <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} /> : null}
      </Card>
    );
  };

  const listHeader = () => (
    <View style={styles.listHeader}>
      <Segmented options={STUDY_OPTIONS} value={studyMode} onChange={setStudyMode} />
      <Pressable
        onPress={() => router.push('/questoes/buscar')}
        accessibilityRole="button"
        accessibilityLabel="Procurar questões"
        style={({ pressed }) => [
          styles.searchEntry,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          pressed && { opacity: 0.8 },
        ]}>
        <Ionicons name="search" size={18} color={colors.primary} />
        <Text style={[styles.searchEntryText, { color: colors.textMuted }]}>Procurar questões</Text>
        <Ionicons name="options-outline" size={18} color={colors.textSubtle} />
      </Pressable>
      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          {studyMode === 'discipline' ? 'Escolha uma disciplina' : 'Escolha um concurso'}
        </Text>
        <View style={[styles.sectionMarker, { backgroundColor: colors.primary }]} />
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Questões"
        subtitle={
          canViewStatistics && performance.total > 0
              ? `${performance.total} respondidas · ${formatPercent(performance.accuracy)} de acerto`
              : canViewStatistics
              ? 'Estude por disciplina e acompanhe seu progresso'
              : `Plano Básico · ${dailyQuestionsRemaining} de ${dailyQuestionLimit} questões disponíveis hoje`
        }
      />

      <FlatList
        data={studyItems}
        keyExtractor={(item) => `${item.kind}:${item.value.name}`}
        renderItem={({ item }) =>
          item.kind === 'discipline'
            ? renderDiscipline({ item: item.value })
            : renderConcurso(item.value)
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xxxl }]}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.md,
  },
  listHeader: {
    gap: Spacing.sm + 2,
  },
  searchEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  searchEntryText: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  sectionLabel: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
  },
  sectionHeading: { gap: 4, marginBottom: Spacing.sm },
  sectionMarker: { width: 28, height: 2, borderRadius: Radius.pill },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 72,
  },
  iconWrapper: {
    width: 24,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  name: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
  },
  meta: {
    fontSize: FontSize.small,
    lineHeight: 17,
  },
});
