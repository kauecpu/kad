import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuestionCard } from '@/components/question-card';
import { EmptyState } from '@/components/ui/empty-state';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { searchQuestions } from '@/lib/search';
import { useApp } from '@/providers/app-provider';
import { useSearch } from '@/providers/search-provider';
import type { Question } from '@/types';

export default function SearchResultsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { answers, answerQuestion, resetQuestion } = useApp();
  const { search } = useSearch();

  const results = useMemo(() => searchQuestions(search, answers), [search, answers]);

  const renderItem = ({ item, index }: { item: Question; index: number }) => (
    <QuestionCard
      question={item}
      position={index + 1}
      total={results.length}
      answer={answers[item.id]}
      onAnswer={answerQuestion}
      onReset={resetQuestion}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title="Resultados"
        subtitle={
          results.length === 0
            ? 'Nenhuma questão encontrada'
            : `${results.length} ${results.length === 1 ? 'questão encontrada' : 'questões encontradas'}`
        }
        onBack={() => router.back()}
      />

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + Spacing.xxxl },
          results.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Nenhuma questão encontrada"
            description="Ajuste os filtros e tente novamente."
            actionLabel="Voltar aos filtros"
            onAction={() => router.back()}
          />
        }
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
    padding: Spacing.lg,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
