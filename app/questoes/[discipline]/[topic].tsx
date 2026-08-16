import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuestionCard } from '@/components/question-card';
import { QuestionFilterSheet, type FilterOptions } from '@/components/question-filter-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterButton } from '@/components/ui/filter-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { QUESTIONS } from '@/data/questions';
import { useTheme } from '@/hooks/use-theme';
import { countActiveFilters, EMPTY_FILTERS, filterQuestions } from '@/lib/questions';
import { useApp } from '@/providers/app-provider';
import type { QuestionFilters } from '@/types';

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export default function TopicPlayerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { discipline, topic } = useLocalSearchParams<{ discipline: string; topic: string }>();
  const { answers, answerQuestion, resetQuestion } = useApp();
  const generalMode = topic === 'geral';

  const topicQuestions = useMemo(
    () =>
      QUESTIONS.filter(
        (question) =>
          question.discipline === discipline && (generalMode || question.topic === topic)
      ),
    [discipline, generalMode, topic]
  );

  const options = useMemo<FilterOptions>(
    () => ({
      boards: unique(topicQuestions.map((q) => q.board)).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      years: unique(topicQuestions.map((q) => q.year)).sort((a, b) => b - a),
      roles: unique(topicQuestions.map((q) => q.role)).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    }),
    [topicQuestions]
  );

  const [filters, setFilters] = useState<QuestionFilters>(EMPTY_FILTERS);
  const [index, setIndex] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const questions = useMemo(() => filterQuestions(topicQuestions, filters), [topicQuestions, filters]);
  const activeCount = countActiveFilters(filters);

  const goTo = (next: number) => {
    setIndex(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleChangeFilters = (next: QuestionFilters) => {
    setFilters(next);
    setIndex(0);
  };

  if (topicQuestions.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title={generalMode ? discipline : topic ?? 'Questões'} onBack={() => router.back()} />
        <EmptyState
          icon="reader-outline"
          title={generalMode ? 'Questões em breve' : 'Nenhuma questão neste assunto'}
          description={
            generalMode
              ? 'Ainda não há questões disponíveis para esta disciplina.'
              : 'Ainda não há questões cadastradas para este assunto.'
          }
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const current = questions[Math.min(index, Math.max(0, questions.length - 1))];
  const isFirst = index === 0;
  const isLast = index >= questions.length - 1;
  const progress = questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title={generalMode ? discipline : topic ?? 'Questões'}
        subtitle={generalMode ? 'Todos os assuntos' : discipline}
        onBack={() => router.back()}
        right={
          <FilterButton
            activeCount={activeCount}
            onPress={() => setSheetVisible(true)}
            showLabel
          />
        }
      />

      {questions.length > 0 ? (
        <View style={styles.progressArea}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.text }]}>
              {`Questão ${index + 1} de ${questions.length}`}
            </Text>
            <Text style={[styles.progressContext, { color: colors.textMuted }]}>
              {generalMode ? current.topic : discipline}
            </Text>
          </View>
          <ProgressBar value={progress} label={`Questão ${index + 1} de ${questions.length}`} />
        </View>
      ) : null}

      {questions.length === 0 ? (
        <EmptyState
          icon="funnel-outline"
          title="Nenhuma questão com esses filtros"
          description={
            generalMode
              ? 'Ajuste os filtros para ver mais questões desta disciplina.'
              : 'Ajuste os filtros para ver mais questões deste assunto.'
          }
          actionLabel="Limpar filtros"
          onAction={() => handleChangeFilters(EMPTY_FILTERS)}
        />
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxxl }]}
            showsVerticalScrollIndicator={false}>
            <QuestionCard
              key={current.id}
              question={current}
              position={index + 1}
              total={questions.length}
              showPosition={false}
              answer={answers[current.id]}
              onAnswer={answerQuestion}
              onReset={resetQuestion}
            />
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingBottom: insets.bottom + Spacing.md,
                backgroundColor: colors.background,
                borderTopColor: colors.border,
              },
            ]}>
            <Button
              label="Anterior"
              variant="secondary"
              icon="chevron-back"
              onPress={() => goTo(index - 1)}
              disabled={isFirst}
              style={styles.footerButton}
            />
            {isLast ? (
              <Button
                label="Concluir sessão"
                icon="checkmark-done"
                onPress={() => router.back()}
                disabled={!answers[current.id]}
                style={styles.footerButton}
              />
            ) : (
              <Button
                label="Próxima questão"
                icon="chevron-forward"
                onPress={() => goTo(index + 1)}
                disabled={!answers[current.id]}
                style={styles.footerButton}
              />
            )}
          </View>
        </>
      )}

      <QuestionFilterSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        filters={filters}
        onChange={handleChangeFilters}
        options={options}
        resultCount={questions.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  progressArea: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  progressLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
  },
  progressContext: {
    flex: 1,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.medium,
    textAlign: 'right',
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
  },
  footer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    flex: 1,
  },
});
