import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { MultiSelectSheet } from '@/components/ui/multi-select-sheet';
import { SearchField } from '@/components/ui/search-field';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { StackHeader } from '@/components/ui/stack-header';
import {
  CONTENT_MAX_WIDTH,
  FontSize,
  FontWeight,
  Radius,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toggleValue } from '@/lib/questions';
import {
  countSearchFilters,
  SEARCH_OPTIONS,
  searchQuestions,
  topicsForDisciplines,
} from '@/lib/search';
import { useApp } from '@/providers/app-provider';
import { useSearch } from '@/providers/search-provider';
import type { AnsweredFilter, ResultFilter } from '@/types';

type Mode = 'basic' | 'advanced';
type SheetKey = 'disciplines' | 'topics' | 'boards' | 'roles' | 'institutions';

const MODE_OPTIONS: SegmentedOption<Mode>[] = [
  { value: 'basic', label: 'Básicos' },
  { value: 'advanced', label: 'Avançados' },
];

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

  const [mode, setMode] = useState<Mode>('basic');
  const [sheet, setSheet] = useState<SheetKey | null>(null);

  const matchCount = useMemo(() => searchQuestions(search, answers).length, [search, answers]);
  const availableTopics = useMemo(
    () => topicsForDisciplines(search.disciplines),
    [search.disciplines]
  );
  const activeCount = countSearchFilters(search);

  const sheetConfig: Record<
    SheetKey,
    { title: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }
  > = {
    disciplines: {
      title: 'Disciplina',
      options: SEARCH_OPTIONS.disciplines,
      selected: search.disciplines,
      onChange: (v) => {
        const allowedTopics = topicsForDisciplines(v);
        update({
          disciplines: v,
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
      options: SEARCH_OPTIONS.boards,
      selected: search.boards,
      onChange: (v) => update({ boards: v }),
    },
    roles: {
      title: 'Cargo',
      options: SEARCH_OPTIONS.roles,
      selected: search.roles,
      onChange: (v) => update({ roles: v }),
    },
    institutions: {
      title: 'Concurso / órgão',
      options: SEARCH_OPTIONS.institutions,
      selected: search.institutions,
      onChange: (v) => update({ institutions: v }),
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
      <StackHeader title="Procurar questões" onBack={() => router.back()} center />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <SearchField
          value={search.keyword}
          onChangeText={(keyword) => update({ keyword })}
          placeholder="Buscar por palavra-chave"
        />

        <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />

        {mode === 'basic' ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderFilterRow('disciplines')}
              {renderFilterRow('topics')}
              {renderFilterRow('boards')}
              {renderFilterRow('roles', true)}
            </View>

            <FilterGroup label="Ano" count={search.years.length}>
              <View style={styles.chips}>
                {SEARCH_OPTIONS.years.map((year) => (
                  <Chip
                    key={year}
                    label={String(year)}
                    selected={search.years.includes(year)}
                    onPress={() => update({ years: toggleValue(search.years, year) })}
                  />
                ))}
              </View>
            </FilterGroup>
          </>
        ) : (
          <>
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

            <FilterGroup label="Dificuldade" count={search.difficulties.length}>
              <View style={styles.chips}>
                {SEARCH_OPTIONS.difficulties.map((level) => (
                  <Chip
                    key={level}
                    label={level}
                    selected={search.difficulties.includes(level)}
                    onPress={() => update({ difficulties: toggleValue(search.difficulties, level) })}
                  />
                ))}
              </View>
            </FilterGroup>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderFilterRow('institutions', true)}
            </View>
          </>
        )}

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

function FilterGroup({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Text style={[styles.groupLabel, { color: colors.textSubtle }]}>{label.toUpperCase()}</Text>
        {count && count > 0 ? (
          <View style={[styles.countPill, { backgroundColor: colors.primary }]}>
            <Text style={[styles.countText, { color: colors.onPrimary }]}>{count}</Text>
          </View>
        ) : null}
      </View>
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
    gap: 2,
  },
  filterLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  filterSummary: {
    fontSize: FontSize.small,
  },
  group: {
    gap: Spacing.sm + 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  groupLabel: {
    ...Typography.overline,
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
