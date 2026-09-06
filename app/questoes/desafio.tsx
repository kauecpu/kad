import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuestionCard } from '@/components/question-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sortConcursos } from '@/lib/concursos';
import { buildQuickChallenge } from '@/lib/quick-challenge';
import { useApp } from '@/providers/app-provider';
import { useConcursos } from '@/providers/concursos-provider';
import { useQuestions } from '@/providers/questions-provider';
import type { Question } from '@/types';

export default function QuickChallengeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    profile,
    savedConcursos,
    answers,
    answerQuestion,
    resetQuestion,
  } = useApp();
  const { concursos } = useConcursos();
  const {
    questions: availableQuestions,
    packs,
    loading,
    error,
    refresh,
  } = useQuestions();
  const focusedConcurso = sortConcursos(
    concursos.filter(
      (concurso) =>
        savedConcursos.includes(concurso.id) && concurso.status !== 'encerrado'
    ),
    'deadline'
  )[0];
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (loading || questions !== null || availableQuestions.length === 0) return;
    setQuestions(
      buildQuickChallenge(
        profile.targetRole,
        focusedConcurso,
        answers,
        availableQuestions,
        packs,
      ),
    );
  }, [answers, availableQuestions, focusedConcurso, loading, packs, profile.targetRole, questions]);

  const initializing = loading || (questions === null && availableQuestions.length > 0);

  if (!questions || questions.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title="Desafio rápido" onBack={() => router.back()} center />
        {initializing ? (
          <View
            style={styles.loading}
            accessibilityRole="progressbar"
            accessibilityLabel="Carregando desafio rápido">
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Preparando questões…</Text>
          </View>
        ) : (
          <EmptyState
            icon={error ? 'cloud-offline-outline' : 'reader-outline'}
            title={error ? 'Não foi possível carregar as questões' : 'Desafio em preparação'}
            description={
              error
                ? 'Confira sua conexão e tente novamente.'
                : 'Ainda não há questões publicadas para este desafio.'
            }
            actionLabel={error ? 'Tentar novamente' : 'Voltar'}
            onAction={error ? () => void refresh() : () => router.back()}
          />
        )}
      </View>
    );
  }

  const current = questions[index];
  const isFirst = index === 0;
  const isLast = index === questions.length - 1;
  const progress = questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0;

  const goTo = (next: number) => {
    setIndex(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title="Desafio rápido"
        subtitle={
          focusedConcurso
            ? `${questions.length} questões para ${focusedConcurso.shortName}`
            : profile.targetRole
              ? `${questions.length} questões para ${profile.targetRole}`
              : `${questions.length} questões variadas · cerca de 5 minutos`
        }
        onBack={() => router.back()}
        center
      />

      <View style={styles.progressArea}>
        <ProgressBar
          value={progress}
          label={`Questão ${index + 1} de ${questions.length}`}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxxl }]}
        showsVerticalScrollIndicator={false}>
        <QuestionCard
          key={current.id}
          question={current}
          position={index + 1}
          total={questions.length}
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
        <Button
          label={isLast ? 'Concluir' : 'Próxima'}
          icon={isLast ? 'checkmark-done' : 'chevron-forward'}
          onPress={isLast ? () => router.back() : () => goTo(index + 1)}
          disabled={!answers[current.id]}
          style={styles.footerButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  loadingText: {
    fontSize: FontSize.body,
    textAlign: 'center',
  },
  progressArea: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
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
  footerButton: { flex: 1 },
});
