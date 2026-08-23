import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ConcursoFilterSheet,
  type ConcursoFilterSection,
} from '@/components/concurso-filter-sheet';
import { ConcursoCard } from '@/components/concurso-card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { FeaturedCard } from '@/components/ui/featured-card';
import { DrawerMenuButton } from '@/components/ui/drawer-menu-button';
import { MultiSelectSheet } from '@/components/ui/multi-select-sheet';
import { SearchField } from '@/components/ui/search-field';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import {
  CONTENT_MAX_WIDTH,
  FontSize,
  FontWeight,
  Fonts,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOpenAppDrawer } from '@/hooks/use-open-app-drawer';
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
  const openMenu = useOpenAppDrawer();
  const { profile, savedConcursos, toggleSavedConcurso } = useApp();
  const { concursos, loading } = useConcursos();
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

  const filterSections = useMemo<ConcursoFilterSection[]>(
    () => [
      {
        key: 'states',
        title: 'Estado',
        options: unique(concursos.map((concurso) => concurso.state)),
      },
      {
        key: 'levels',
        title: 'Escolaridade',
        options: unique(concursos.flatMap((concurso) => concurso.levels)),
      },
      {
        key: 'salaryRanges',
        title: 'Faixa salarial',
        options: [
          'Até R$ 3 mil',
          'R$ 3 mil a R$ 6 mil',
          'R$ 6 mil a R$ 10 mil',
          'Acima de R$ 10 mil',
        ],
      },
      {
        key: 'roles',
        title: 'Cargo',
        options: unique(concursos.flatMap((concurso) => concurso.roles.map((role) => role.name))),
      },
      {
        key: 'boards',
        title: 'Banca',
        options: unique(concursos.map((concurso) => concurso.board)),
      },
    ],
    [concursos]
  );

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
    const targeted = goalMode ? recommendConcursosForGoal(filtered, targetRole) : filtered;
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

  const showGoalSuggestion =
    results.length > 0 &&
    !query &&
    targetRole &&
    activeFilterCount === 0 &&
    !goalMode &&
    goalMatches.length > 0;

  const listHeader = showGoalSuggestion ? (
    <View style={styles.listHeader}>
      <FeaturedCard
        onPress={() => setGoalMode(true)}
        accessibilityLabel={`Ver concursos para sua meta: ${targetRole}`}
        icon="navigate-outline"
        eyebrow="FOCO DA META"
        title={targetRole}
        description={`${goalMatches.length} ${goalMatches.length === 1 ? 'oportunidade compatível' : 'oportunidades compatíveis'} com sua direção atual.`}
        actionLabel="Ver oportunidades"
        compact
      />
    </View>
  ) : null;

  const resultLabel = `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.sm,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}>
        <View style={styles.headerInner}>
          <View style={styles.titleRow}>
            <DrawerMenuButton onPress={openMenu} />
            <View style={styles.titleGroup}>
              <View style={styles.eyebrowRow}>
                <View style={[styles.eyebrowRail, { backgroundColor: colors.primary }]} />
                <Text style={[styles.eyebrow, { color: colors.primary }]}>KAD / CONCURSOS</Text>
              </View>
              <Text
                style={[styles.title, { color: colors.text }]}
                accessibilityRole="header">
                Radar de editais
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/concursos/salvos')}
              accessibilityRole="button"
              accessibilityLabel={`Abrir concursos salvos. ${savedConcursos.length} salvos`}
              style={({ pressed }) => [
                styles.savedButton,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
              <Text style={[styles.savedLabel, { color: colors.text }]}>Salvos</Text>
              {savedConcursos.length > 0 ? (
                <View style={[styles.savedCount, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.savedCountText, { color: colors.onPrimary }]}>
                    {savedConcursos.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <SearchField
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setGoalMode(false);
            }}
            placeholder="Buscar órgão, cargo ou banca"
            accessibilityLabel="Buscar por órgão, cargo, banca ou estado"
          />

          <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} />

          <View style={styles.refineRow}>
            <View style={styles.resultSummary} accessibilityLiveRegion="polite">
              {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              <Text style={[styles.resultCount, { color: colors.textSubtle }]}>{resultLabel}</Text>
            </View>
            <View style={styles.refineActions}>
              <Pressable
                onPress={() => setFiltersVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={
                  activeFilterCount > 0
                    ? `Abrir filtros. ${activeFilterCount} ativos`
                    : 'Abrir filtros'
                }
                style={({ pressed }) => [
                  styles.refineButton,
                  {
                    backgroundColor:
                      activeFilterCount > 0 ? colors.primarySoft : colors.surfaceAlt,
                    borderColor:
                      activeFilterCount > 0 ? colors.borderStrong : colors.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="options-outline" size={16} color={colors.primary} />
                <Text style={[styles.refineLabel, { color: colors.text }]}>
                  {activeFilterCount > 0 ? `Filtros ${activeFilterCount}` : 'Filtros'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSortVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={`Ordenar por ${selectedSort.label}`}
                style={({ pressed }) => [
                  styles.refineButton,
                  {
                    backgroundColor: sort !== 'deadline' ? colors.primarySoft : colors.surfaceAlt,
                    borderColor: sort !== 'deadline' ? colors.borderStrong : colors.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="swap-vertical" size={16} color={colors.primary} />
                <Text style={[styles.refineLabel, { color: colors.text }]}>
                  {selectedSort.shortLabel}
                </Text>
              </Pressable>
            </View>
          </View>

          {activeFilterCount > 0 || goalMode ? (
            <View style={styles.activeFilterRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activeFilters}>
                {goalMode ? (
                  <Chip
                    label={`Meta: ${targetRole}`}
                    selected
                    icon="close"
                    onPress={() => setGoalMode(false)}
                  />
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
              <Pressable
                onPress={clearRefinements}
                accessibilityRole="button"
                accessibilityLabel="Limpar filtros ativos"
                hitSlop={8}>
                <Text style={[styles.clearFilters, { color: colors.primary }]}>Limpar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ConcursoCard
            concurso={item}
            index={index + 1}
            saved={savedConcursos.includes(item.id)}
            onPress={() => router.push(`/concurso/${item.id}`)}
            onToggleSave={() => handleToggleSave(item.id, item.shortName)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
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
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerInner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 10,
  },
  titleRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  titleGroup: { flex: 1, minWidth: 0, gap: 3 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  eyebrowRail: { width: 22, height: 3, transform: [{ skewX: '-24deg' }] },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.9,
  },
  title: {
    fontSize: FontSize.display,
    lineHeight: 34,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.75,
  },
  refineRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  resultSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  resultCount: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.semibold,
  },
  refineActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  refineButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  refineLabel: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  clearFilters: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  activeFilterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  activeFilters: { gap: Spacing.sm, paddingRight: Spacing.sm },
  list: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  listHeader: { marginBottom: Spacing.md },
  savedButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
});
