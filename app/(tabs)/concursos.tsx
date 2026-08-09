import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ConcursoFilterSheet,
  type ConcursoFilterSection,
} from '@/components/concurso-filter-sheet';
import { ConcursoCard } from '@/components/concurso-card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { MultiSelectSheet } from '@/components/ui/multi-select-sheet';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SearchField } from '@/components/ui/search-field';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  EMPTY_CONCURSO_FILTERS,
  filterByStatus,
  matchesSalaryRanges,
  recommendConcursosForGoal,
  searchConcursos,
  sortConcursos,
  type ConcursoFilterKey,
  type ConcursoFilters,
  type ConcursoSort,
  type SalaryRange,
  type StatusFilter,
} from '@/lib/concursos';
import { useApp } from '@/providers/app-provider';
import { useConcursos } from '@/providers/concursos-provider';

const STATUS_OPTIONS: SegmentedOption<StatusFilter>[] = [
  { value: 'aberto', label: 'Abertos' },
  { value: 'previsto', label: 'Previstos' },
  { value: 'todos', label: 'Todos' },
];

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const FILTER_LABEL: Record<ConcursoFilterKey, string> = {
  states: 'Estado',
  levels: 'Escolaridade',
  salaryRanges: 'Salário',
  roles: 'Cargo',
  boards: 'Banca',
};

const SORT_OPTIONS: { value: ConcursoSort; label: string; shortLabel: string }[] = [
  { value: 'deadline', label: 'Prazo mais próximo', shortLabel: 'Prazo' },
  { value: 'salary', label: 'Maior salário', shortLabel: 'Salário' },
  { value: 'vacancies', label: 'Mais vagas', shortLabel: 'Vagas' },
  { value: 'updated', label: 'Atualizados recentemente', shortLabel: 'Atualização' },
];

const SALARY_RANGE_BY_LABEL: Record<string, SalaryRange> = {
  'Até R$ 3 mil': 'until-3000',
  'R$ 3 mil a R$ 6 mil': '3000-6000',
  'R$ 6 mil a R$ 10 mil': '6000-10000',
  'Acima de R$ 10 mil': 'above-10000',
};

export default function ConcursosScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, savedConcursos, toggleSavedConcurso } = useApp();
  const { concursos } = useConcursos();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('aberto');
  const [filters, setFilters] = useState<ConcursoFilters>(EMPTY_CONCURSO_FILTERS);
  const [sort, setSort] = useState<ConcursoSort>('deadline');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [goalMode, setGoalMode] = useState(false);
  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRole = profile.targetRole?.trim() ?? '';

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    []
  );

  const activeFilterEntries = useMemo(
    () =>
      (Object.keys(filters) as ConcursoFilterKey[]).flatMap((key) =>
        filters[key].map((value) => ({ key, value }))
      ),
    [filters]
  );
  const activeFilterCount = activeFilterEntries.length;
  const selectedSort = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

  const filterSections = useMemo<ConcursoFilterSection[]>(() => [
    { key: 'states', title: 'Estado', options: unique(concursos.map((concurso) => concurso.state)) },
    { key: 'levels', title: 'Escolaridade', options: unique(concursos.flatMap((concurso) => concurso.levels)) },
    { key: 'salaryRanges', title: 'Faixa salarial', options: ['Até R$ 3 mil', 'R$ 3 mil a R$ 6 mil', 'R$ 6 mil a R$ 10 mil', 'Acima de R$ 10 mil'] },
    { key: 'roles', title: 'Cargo', options: unique(concursos.flatMap((concurso) => concurso.roles.map((role) => role.name))) },
    { key: 'boards', title: 'Banca', options: unique(concursos.map((concurso) => concurso.board)) },
  ], [concursos]);

  const goalMatches = useMemo(
    () => recommendConcursosForGoal(filterByStatus(concursos, status), targetRole),
    [concursos, status, targetRole]
  );

  const results = useMemo(() => {
    const byStatus = filterByStatus(concursos, status);
    const bySearch = searchConcursos(byStatus, query);
    const filtered = bySearch.filter((concurso) => {
      if (filters.boards.length > 0 && !filters.boards.includes(concurso.board)) return false;
      if (filters.states.length > 0 && !filters.states.includes(concurso.state)) return false;
      if (
        filters.levels.length > 0 &&
        !concurso.levels.some((level) => filters.levels.includes(level))
      ) {
        return false;
      }
      if (
        filters.roles.length > 0 &&
        !concurso.roles.some((role) => filters.roles.includes(role.name))
      ) {
        return false;
      }
      if (
        !matchesSalaryRanges(
          concurso,
          filters.salaryRanges
            .map((label) => SALARY_RANGE_BY_LABEL[label])
            .filter((range): range is SalaryRange => Boolean(range))
        )
      ) {
        return false;
      }
      return true;
    });
    const targeted = goalMode
      ? recommendConcursosForGoal(filtered, targetRole)
      : filtered;
    return sortConcursos(targeted, sort);
  }, [concursos, status, query, filters, sort, goalMode, targetRole]);

  const showFeedback = (message: string) => {
    setFeedback(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 2400);
  };

  const handleToggleSave = (id: string, title: string) => {
    const wasSaved = savedConcursos.includes(id);
    toggleSavedConcurso(id);
    showFeedback(wasSaved ? `${title} removido dos salvos.` : `${title} salvo em Meus concursos.`);
  };

  const removeFilter = (key: ConcursoFilterKey, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: current[key].filter((item) => item !== value),
    }));
  };

  const clearRefinements = () => {
    setFilters(EMPTY_CONCURSO_FILTERS);
    setGoalMode(false);
  };

  const listHeader = results.length > 0 ? (
    <View style={styles.listHeader}>
      {!query && targetRole && activeFilterCount === 0 && !goalMode && goalMatches.length > 0 ? (
        <Pressable
          onPress={() => setGoalMode(true)}
          accessibilityRole="button"
          accessibilityLabel={`Ver concursos para sua meta: ${targetRole}`}
          style={({ pressed }) => [
            styles.goalCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}>
          <View style={styles.goalIcon}>
            <Ionicons name="locate-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.goalText}>
            <Text style={[styles.goalTitle, { color: colors.text }]} numberOfLines={1}>
              {targetRole}
            </Text>
            <Text style={[styles.goalDescription, { color: colors.textMuted }]}>
              {`${goalMatches.length} ${goalMatches.length === 1 ? 'oportunidade compatível' : 'oportunidades compatíveis'}`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      ) : null}
      <Text style={[styles.resultCount, { color: colors.textSubtle }]}>
        {`${results.length} ${results.length === 1 ? 'concurso encontrado' : 'concursos encontrados'}`}
      </Text>
    </View>
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Concursos"
        subtitle="Editais abertos e previstos pelo Brasil"
        right={
          <Pressable
            onPress={() => router.push('/concursos/salvos')}
            accessibilityRole="button"
            accessibilityLabel={`Abrir concursos salvos. ${savedConcursos.length} salvos`}
            style={({ pressed }) => [
              styles.savedButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="bookmark-outline" size={17} color={colors.primary} />
            <Text style={[styles.savedLabel, { color: colors.text }]}>Salvos</Text>
            {savedConcursos.length > 0 ? (
              <View style={[styles.savedCount, { backgroundColor: colors.primary }]}>
                <Text style={[styles.savedCountText, { color: colors.onPrimary }]}>
                  {savedConcursos.length}
                </Text>
              </View>
            ) : null}
          </Pressable>
        }>
        <SearchField
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setGoalMode(false);
          }}
          placeholder="Buscar concursos"
          accessibilityLabel="Buscar por órgão, cargo, banca ou estado"
        />
        <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <View style={styles.refineRow}>
          <Chip
            label={activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : 'Filtros'}
            selected={activeFilterCount > 0}
            icon="options-outline"
            onPress={() => setFiltersVisible(true)}
          />
          <Chip
            label={`Ordenar · ${selectedSort.shortLabel}`}
            selected={sort !== 'deadline'}
            icon="swap-vertical"
            onPress={() => setSortVisible(true)}
          />
          {activeFilterCount > 0 || goalMode ? (
            <Pressable
              onPress={clearRefinements}
              accessibilityRole="button"
              accessibilityLabel="Limpar filtros ativos"
              hitSlop={8}>
              <Text style={[styles.clearFilters, { color: colors.primary }]}>Limpar</Text>
            </Pressable>
          ) : null}
        </View>
        {activeFilterCount > 0 || goalMode ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFilters}>
            {goalMode ? (
              <Chip label={`Meta: ${targetRole}`} selected icon="close" onPress={() => setGoalMode(false)} />
            ) : null}
            {activeFilterEntries.map(({ key, value }) => (
              <Chip
                key={`${key}-${value}`}
                label={`${FILTER_LABEL[key]}: ${value}`}
                selected
                icon="close"
                onPress={() => removeFilter(key, value)}
              />
            ))}
          </ScrollView>
        ) : null}
      </ScreenHeader>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConcursoCard
            concurso={item}
            saved={savedConcursos.includes(item.id)}
            onPress={() => router.push(`/concurso/${item.id}`)}
            onToggleSave={() => handleToggleSave(item.id, item.shortName)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm + 2 }} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + Spacing.xxxl },
          results.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Nenhum concurso encontrado"
            description="Tente outra busca ou ajuste os filtros selecionados."
            actionLabel={activeFilterCount > 0 || goalMode ? 'Limpar filtros' : undefined}
            onAction={activeFilterCount > 0 || goalMode ? clearRefinements : undefined}
          />
        }
      />

      <ConcursoFilterSheet
        visible={filtersVisible}
        filters={filters}
        sections={filterSections}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_CONCURSO_FILTERS)}
        onClose={() => setFiltersVisible(false)}
      />
      <MultiSelectSheet
        visible={sortVisible}
        title="Ordenar por"
        options={SORT_OPTIONS.map((option) => option.label)}
        selected={[selectedSort.label]}
        onChange={(selected) => {
          const selectedOption = SORT_OPTIONS.find((option) => option.label === selected[0]);
          if (selectedOption) setSort(selectedOption.value);
        }}
        onClose={() => setSortVisible(false)}
        selectionMode="single"
      />
      <FeedbackToast message={feedback} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  refineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  clearFilters: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  activeFilters: { gap: Spacing.sm, paddingRight: Spacing.md },
  list: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.sm + 2,
  },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  listHeader: { gap: Spacing.md, marginBottom: Spacing.md },
  resultCount: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  goalIcon: {
    width: 22,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalText: { flex: 1, minWidth: 0, gap: 2 },
  goalTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  goalDescription: { fontSize: FontSize.small },
  savedButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  savedLabel: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  savedCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCountText: { fontSize: 10, fontWeight: FontWeight.bold },
  pressed: { opacity: 0.7 },
});
