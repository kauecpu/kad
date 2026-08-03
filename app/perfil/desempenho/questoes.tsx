import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuestionCard } from '@/components/question-card';
import { QuestionFilterSheet, type FilterOptions } from '@/components/question-filter-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterButton } from '@/components/ui/filter-button';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, Spacing } from '@/constants/theme';
import { QUESTIONS } from '@/data/questions';
import { useTheme } from '@/hooks/use-theme';
import { countActiveFilters, EMPTY_FILTERS, filterQuestions } from '@/lib/questions';
import {
  questionsForReview,
  type QuestionReviewType,
} from '@/lib/question-review';
import { useApp } from '@/providers/app-provider';
import type { Question, QuestionFilters } from '@/types';

const COPY: Record<
  QuestionReviewType,
  { title: string; emptyTitle: string; emptyDescription: string; icon: 'bookmark-outline' | 'checkmark-circle-outline' | 'close-circle-outline' }
> = {
  favorites: {
    title: 'Questões favoritas',
    emptyTitle: 'Nenhuma questão favorita',
    emptyDescription: 'Use o marcador nas questões que deseja revisar depois.',
    icon: 'bookmark-outline',
  },
  correct: {
    title: 'Questões acertadas',
    emptyTitle: 'Nenhuma questão acertada',
    emptyDescription: 'As questões que você acertar aparecerão aqui.',
    icon: 'checkmark-circle-outline',
  },
  wrong: {
    title: 'Questões erradas',
    emptyTitle: 'Nenhuma questão errada',
    emptyDescription: 'As questões que você errar aparecerão aqui para revisão.',
    icon: 'close-circle-outline',
  },
};

function normalizeType(value?: string | string[]): QuestionReviewType {
  const type = Array.isArray(value) ? value[0] : value;
  return type === 'correct' || type === 'wrong' ? type : 'favorites';
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export default function PerformanceQuestionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tipo } = useLocalSearchParams<{ tipo?: string | string[] }>();
  const {
    answers,
    favoriteQuestionIds,
    canViewStatistics,
    answerQuestion,
    canAnswerQuestion,
    resetQuestion,
  } = useApp();
  const type = normalizeType(tipo);
  const copy = COPY[type];
  const isFilterable = type === 'wrong' || type === 'favorites';
  const [filters, setFilters] = useState<QuestionFilters>(EMPTY_FILTERS);
  const [sheetVisible, setSheetVisible] = useState(false);

  const reviewQuestions = useMemo(
    () => questionsForReview(QUESTIONS, answers, favoriteQuestionIds, type),
    [answers, favoriteQuestionIds, type]
  );
  const filterOptions = useMemo<FilterOptions>(
    () => ({
      subjects: unique(reviewQuestions.map((question) => question.subject)).sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
      boards: unique(reviewQuestions.map((question) => question.board)).sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
      years: unique(reviewQuestions.map((question) => question.year)).sort((a, b) => b - a),
      roles: unique(reviewQuestions.map((question) => question.role)).sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    }),
    [reviewQuestions]
  );
  const questions = useMemo(
    () => (isFilterable ? filterQuestions(reviewQuestions, filters) : reviewQuestions),
    [filters, isFilterable, reviewQuestions]
  );
  const activeFilterCount = isFilterable ? countActiveFilters(filters) : 0;

  const renderItem = ({ item, index }: { item: Question; index: number }) => (
    <QuestionCard
      question={item}
      position={index + 1}
      total={questions.length}
      answer={answers[item.id]}
      canAnswer={canAnswerQuestion(item.id)}
      onLimitReached={() => router.push('/perfil/planos')}
      onAnswer={answerQuestion}
      onReset={resetQuestion}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title={copy.title}
        subtitle={canViewStatistics ? `${questions.length} ${questions.length === 1 ? 'questão' : 'questões'}` : undefined}
        onBack={() => router.back()}
        right={
          isFilterable && reviewQuestions.length > 0 ? (
            <FilterButton
              activeCount={activeFilterCount}
              onPress={() => setSheetVisible(true)}
            />
          ) : undefined
        }
      />

      {canViewStatistics ? (
        <FlatList
          data={questions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.xl }} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + Spacing.xxxl },
            questions.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            activeFilterCount > 0 ? (
              <EmptyState
                icon="funnel-outline"
                title="Nenhuma questão com esses filtros"
                description={
                  type === 'favorites'
                    ? 'Ajuste os filtros para encontrar outras questões favoritas.'
                    : 'Ajuste os filtros para encontrar outras questões erradas.'
                }
                actionLabel="Limpar filtros"
                onAction={() => setFilters(EMPTY_FILTERS)}
              />
            ) : (
              <EmptyState
                icon={copy.icon}
                title={copy.emptyTitle}
                description={copy.emptyDescription}
                actionLabel="Ir para questões"
                onAction={() => router.push('/questoes')}
              />
            )
          }
        />
      ) : (
        <View style={styles.locked}>
          <EmptyState
            icon="lock-closed-outline"
            title="Desempenho não incluído"
            description="A revisão por resultado está disponível nos planos KAD."
            actionLabel="Ver planos"
            onAction={() => router.push('/perfil/planos')}
          />
        </View>
      )}

      {isFilterable ? (
        <QuestionFilterSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          filters={filters}
          onChange={setFilters}
          options={filterOptions}
          resultCount={questions.length}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  locked: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
});
