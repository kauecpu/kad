import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuestionCard } from '@/components/question-card';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { findStudyPackForConcurso, sortConcursos } from '@/lib/concursos';
import { questionsForPack, recommendPackForGoal } from '@/lib/simulations';
import { normalizeSearchText } from '@/lib/text';
import { useApp } from '@/providers/app-provider';
import { useConcursos } from '@/providers/concursos-provider';
import { useQuestions } from '@/providers/questions-provider';
import type { AnswerRecord, Concurso, ConcursoPack, Question } from '@/types';

const CHALLENGE_SIZE = 3;

function buildChallenge(
  targetRole: string | undefined,
  focusedConcurso: Concurso | undefined,
  answers: Record<string, AnswerRecord>,
  questions: Question[],
  packs: ConcursoPack[],
): Question[] {
  const goal = normalizeSearchText(targetRole ?? '');
  const exactMatches = goal
    ? questions.filter((question) => normalizeSearchText(question.role) === goal)
    : [];
  const concursoPack = focusedConcurso
    ? findStudyPackForConcurso(focusedConcurso, packs)
    : undefined;
  const goalPack = !focusedConcurso ? recommendPackForGoal(packs, targetRole) : undefined;
  const packQuestions = concursoPack
    ? questionsForPack(concursoPack, questions)
    : goalPack
      ? questionsForPack(goalPack, questions)
      : [];
  const pool = focusedConcurso
    ? packQuestions
    : exactMatches.length >= CHALLENGE_SIZE
      ? exactMatches
      : packQuestions.length >= CHALLENGE_SIZE
        ? packQuestions
        : questions;

  return [...pool]
    .sort((a, b) => Number(Boolean(answers[a.id])) - Number(Boolean(answers[b.id])))
    .slice(0, CHALLENGE_SIZE);
}

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
  const { questions: availableQuestions, packs } = useQuestions();
  const focusedConcurso = sortConcursos(
    concursos.filter(
      (concurso) =>
        savedConcursos.includes(concurso.id) && concurso.status !== 'encerrado'
    ),
    'deadline'
  )[0];
  const [questions] = useState(() =>
    buildChallenge(profile.targetRole, focusedConcurso, answers, availableQuestions, packs)
  );
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

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
