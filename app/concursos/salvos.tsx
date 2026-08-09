import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConcursoCard } from '@/components/concurso-card';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { MultiSelectSheet } from '@/components/ui/multi-select-sheet';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sortConcursos, type ConcursoSort } from '@/lib/concursos';
import { useApp } from '@/providers/app-provider';
import { useConcursos } from '@/providers/concursos-provider';

const SORT_OPTIONS: { value: ConcursoSort; label: string }[] = [
  { value: 'updated', label: 'Atualizados recentemente' },
  { value: 'deadline', label: 'Prazo mais próximo' },
  { value: 'salary', label: 'Maior salário' },
  { value: 'vacancies', label: 'Mais vagas' },
];

export default function SavedConcursosScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedConcursos, toggleSavedConcurso } = useApp();
  const { concursos: availableConcursos } = useConcursos();
  const [sort, setSort] = useState<ConcursoSort>('updated');
  const [sortVisible, setSortVisible] = useState(false);
  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    []
  );

  const selectedSort = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];
  const concursos = useMemo(
    () => sortConcursos(availableConcursos.filter((item) => savedConcursos.includes(item.id)), sort),
    [availableConcursos, savedConcursos, sort]
  );

  const remove = (id: string, title: string) => {
    toggleSavedConcurso(id);
    setFeedback(`${title} removido dos salvos.`);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 2400);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Meus concursos" onBack={() => router.back()} center />

      <FlatList
        data={concursos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConcursoCard
            concurso={item}
            saved
            onPress={() => router.push(`/concurso/${item.id}`)}
            onToggleSave={() => remove(item.id, item.shortName)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + Spacing.xxxl },
          concursos.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          concursos.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={[styles.summary, { color: colors.textMuted }]}>
                {`${concursos.length} ${concursos.length === 1 ? 'concurso salvo' : 'concursos salvos'}`}
              </Text>
              <Pressable
                onPress={() => setSortVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={`Ordenar por ${selectedSort.label}`}
                style={({ pressed }) => [
                  styles.sortButton,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="swap-vertical" size={18} color={colors.primary} />
                <Text style={[styles.sortText, { color: colors.text }]} numberOfLines={1}>
                  {selectedSort.label}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSubtle} />
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="bookmark-outline"
            title="Nenhum concurso salvo"
            description="Ao salvar um edital, ele aparecerá aqui para você acompanhar com facilidade."
            actionLabel="Explorar concursos"
            onAction={() => router.replace('/concursos')}
          />
        }
      />

      <MultiSelectSheet
        visible={sortVisible}
        title="Ordenar por"
        options={SORT_OPTIONS.map((option) => option.label)}
        selected={[selectedSort.label]}
        onChange={(selected) => {
          const option = SORT_OPTIONS.find((item) => item.label === selected[0]);
          if (option) setSort(option.value);
        }}
        onClose={() => setSortVisible(false)}
        selectionMode="single"
      />
      <FeedbackToast message={feedback} icon="bookmark-outline" />
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
    padding: Spacing.lg,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  listHeader: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  summary: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
  },
  sortButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  sortText: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  pressed: {
    opacity: 0.7,
  },
});
