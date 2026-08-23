import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { MultiSelectSheet } from '@/components/ui/multi-select-sheet';
import { SearchField } from '@/components/ui/search-field';
import { StackHeader } from '@/components/ui/stack-header';
import {
  CONTENT_MAX_WIDTH,
  FontSize,
  FontWeight,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  countSearchFilters,
  searchOptionsForQuestions,
  searchQuestions,
  subjectsForDisciplines,
  topicsForSelection,
} from '@/lib/search';
import { useApp } from '@/providers/app-provider';
import { useSearch } from '@/providers/search-provider';
import { useQuestions } from '@/providers/questions-provider';
import type { AnsweredFilter, EducationLevel, ResultFilter } from '@/types';

type SheetKey =
  | 'disciplines'
  | 'subjects'
  | 'topics'
  | 'boards'
  | 'institutions'
  | 'concursos'
  | 'roles'
  | 'years'
  | 'levels'
  | 'difficulties';

const ANSWERED_OPTIONS: { value: AnsweredFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'answered', label: 'Respondidas' },
  { value: 'unanswered', label: 'Não respondidas' },
];

const RESULT_OPTIONS: { value: ResultFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'correct', label: 'Acertei' },
  { value: 'wrong', label: 'Errei' },
];

export default function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { answers, canViewStatistics } = useApp();
  const { search, update, reset } = useSearch();
  const { questions } = useQuestions();
  const searchOptions = useMemo(() => searchOptionsForQuestions(questions), [questions]);

  const [sheet, setSheet] = useState<SheetKey | null>(null);

  const matchCount = useMemo(
    () => searchQuestions(search, answers, questions).length,
    [answers, questions, search],
  );
  const availableSubjects = useMemo(
    () => subjectsForDisciplines(search.disciplines, questions),
    [questions, search.disciplines]
  );
  const availableTopics = useMemo(
    () => topicsForSelection(search.disciplines, search.subjects, questions),
    [questions, search.disciplines, search.subjects]
  );
  const activeCount = countSearchFilters(search);

  const sheetConfig: Record<
    SheetKey,
    { title: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }
  > = {
    disciplines: {
      title: 'Disciplina',
      options: searchOptions.disciplines,
      selected: search.disciplines,
      onChange: (v) => {
        const allowedSubjects = subjectsForDisciplines(v, questions);
        const nextSubjects = search.subjects.filter((subject) =>
          allowedSubjects.includes(subject)
        );
        const allowedTopics = topicsForSelection(v, nextSubjects, questions);
        update({
          disciplines: v,
          subjects: nextSubjects,
          topics: search.topics.filter((topic) => allowedTopics.includes(topic)),
        });
      },
    },
    subjects: {
      title: 'Matéria',
      options: availableSubjects,
      selected: search.subjects,
      onChange: (v) => {
        const allowedTopics = topicsForSelection(search.disciplines, v, questions);
        update({
          subjects: v,
          topics: search.topics.filter((topic) => allowedTopics.includes(topic)),
        });
      },
    },
    topics: {
      title: 'Assunto',
      options: availableTopics,
      selected: search.topics,
      onChange: (v) => update({ topics: v }),
    },
    boards: {
      title: 'Banca',
      options: searchOptions.boards,
      selected: search.boards,
      onChange: (v) => update({ boards: v }),
    },
    roles: {
      title: 'Cargo',
      options: searchOptions.roles,
      selected: search.roles,
      onChange: (v) => update({ roles: v }),
    },
    institutions: {
      title: 'Instituição',
      options: searchOptions.institutions,
      selected: search.institutions,
      onChange: (v) => update({ institutions: v }),
    },
    concursos: {
      title: 'Concurso',
      options: searchOptions.concursos,
      selected: search.concursos,
      onChange: (v) => update({ concursos: v }),
    },
    years: {
      title: 'Ano',
      options: searchOptions.years.map(String),
      selected: search.years.map(String),
      onChange: (v) => update({ years: v.map(Number) }),
    },
    levels: {
      title: 'Escolaridade',
      options: searchOptions.levels,
      selected: search.levels,
      onChange: (v) => update({ levels: v as EducationLevel[] }),
    },
    difficulties: {
      title: 'Dificuldade',
      options: searchOptions.difficulties,
      selected: search.difficulties,
      onChange: (v) => update({ difficulties: v }),
    },
  };

  const activeSheet = sheet ? sheetConfig[sheet] : null;

  const renderFilterRow = (key: SheetKey, isLast = false) => {
    const config = sheetConfig[key];
    const count = config.selected.length;
    return (
      <Pressable
        onPress={() => setSheet(key)}
        accessibilityRole="button"
        accessibilityLabel={`Filtrar por ${config.title}`}
        style={({ pressed }) => [
          styles.filterRow,
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
          pressed && styles.pressed,
        ]}>
        <View style={styles.filterText}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>{config.title}</Text>
          <Text style={[styles.filterSummary, { color: colors.textMuted }]} numberOfLines={1}>
            {count > 0 ? config.selected.join(', ') : 'Todos'}
          </Text>
        </View>
        {count > 0 ? (
          <View style={[styles.countPill, { backgroundColor: colors.primary }]}>
            <Text style={[styles.countText, { color: colors.onPrimary }]}>{count}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title="Procurar questões"
        subtitle="Encontre exatamente o que estudar"
        onBack={() => router.back()}
        center
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <SearchField
          value={search.keyword}
          onChangeText={(keyword) => update({ keyword })}
          placeholder="Buscar por palavra-chave"
        />

        <FilterSection title="Conteúdo" description="Defina o que você quer estudar.">
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            {renderFilterRow('disciplines')}
            {renderFilterRow('subjects')}
            {renderFilterRow('topics', true)}
          </View>
        </FilterSection>

        <FilterSection title="Prova" description="Refine pela origem e pelo perfil da questão.">
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            {renderFilterRow('boards')}
            {renderFilterRow('institutions')}
            {renderFilterRow('concursos')}
            {renderFilterRow('roles')}
            {renderFilterRow('years')}
            {renderFilterRow('levels')}
            {renderFilterRow('difficulties', true)}
          </View>
        </FilterSection>

        <FilterSection title="Seu histórico" description="Use suas tentativas anteriores na busca.">
          <FilterGroup label="Situação">
            <View style={styles.chips}>
              {ANSWERED_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={search.answered === option.value}
                  onPress={() => update({ answered: option.value })}
                />
              ))}
            </View>
          </FilterGroup>

          {canViewStatistics ? (
            <FilterGroup label="Desempenho">
              <View style={styles.chips}>
                {RESULT_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={search.result === option.value}
                    onPress={() => update({ result: option.value })}
                  />
                ))}
              </View>
            </FilterGroup>
          ) : null}
        </FilterSection>

        {activeCount > 0 ? (
          <Button
            label={`Limpar filtros (${activeCount})`}
            variant="ghost"
            icon="trash-outline"
            onPress={reset}
          />
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}>
        <Button
          label={`Buscar questões · ${matchCount}`}
          size="lg"
          icon="search"
          onPress={() => router.push('/questoes/resultados')}
          fullWidth
        />
      </View>

      <MultiSelectSheet
        visible={sheet !== null}
        title={activeSheet?.title ?? ''}
        options={activeSheet?.options ?? []}
        selected={activeSheet?.selected ?? []}
        onChange={(v) => activeSheet?.onChange(v)}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

function FilterSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[styles.sectionDescription, { color: colors.textMuted }]}>
          {description}
        </Text>
      </View>
      {children}
    </View>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
  filterRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  filterText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  filterLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  filterSummary: {
    fontSize: FontSize.small,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    gap: 3,
  },
  sectionTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
  },
  sectionDescription: {
    fontSize: FontSize.small,
    lineHeight: 18,
  },
  group: {
    gap: Spacing.sm + 2,
  },
  groupLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
  },
  footer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
