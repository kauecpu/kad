import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuestionCard } from '@/components/question-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, Spacing } from '@/constants/theme';
import { CONCURSO_PACKS } from '@/data/exam-concursos';
import { useTheme } from '@/hooks/use-theme';
import { questionsForPack } from '@/lib/simulations';
import { useApp } from '@/providers/app-provider';
import { useQuestions } from '@/providers/questions-provider';

export default function ConcursoQuestionPlayerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, discipline, topic } = useLocalSearchParams<{
    id: string;
    discipline?: string;
    topic?: string;
  }>();
  const { answers, answerQuestion, resetQuestion } = useApp();
  const { questions: availableQuestions } = useQuestions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const pack = CONCURSO_PACKS.find((item) => item.id === id);
  const questions = useMemo(() => {
    const packQuestions = pack ? questionsForPack(pack, availableQuestions) : [];
    return packQuestions.filter(
      (question) =>
        (!discipline || question.discipline === discipline) &&
        (!topic || question.topic === topic)
    );
  }, [availableQuestions, discipline, pack, topic]);

  useEffect(() => {
    setIndex(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [id, discipline, topic]);

  if (!pack || questions.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title={topic ?? discipline ?? 'Questões por concurso'} onBack={() => router.back()} />
        <EmptyState
          icon="reader-outline"
          title="Questões em breve"
          description={
            topic
              ? `Ainda não há questões sobre ${topic} para este concurso.`
              : discipline
              ? `Ainda não há questões de ${discipline} para este concurso.`
              : 'Ainda não há questões disponíveis para este concurso.'
          }
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const current = questions[index];
  const isFirst = index === 0;
  const isLast = index === questions.length - 1;
  const progress = ((index + 1) / questions.length) * 100;

  const goTo = (next: number) => {
    setIndex(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title={topic ?? discipline ?? pack.name}
        subtitle={
          topic
            ? `${discipline} · ${pack.name}`
            : discipline
            ? `${pack.name} · ${questions.length} ${questions.length === 1 ? 'questão' : 'questões'}`
            : `Questões gerais · ${questions.length} ${questions.length === 1 ? 'questão' : 'questões'}`
        }
        onBack={() => router.back()}
      />

      <View style={styles.progressArea}>
        <ProgressBar value={progress} label={`Questão ${index + 1} de ${questions.length}`} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
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
  progressArea: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  footer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: { flex: 1 },
});
