import Ionicons from '@/components/ui/app-icon';
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { QuestionComments } from '@/components/question-comments';
import { QuestionCommunityStat } from '@/components/question-community-stat';
import { QuestionFavoriteButton } from '@/components/question-favorite-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExpandableChevron } from '@/components/ui/expandable-chevron';
import { StudyOption } from '@/components/ui/study-option';
import { toneColors, type Tone } from '@/components/ui/tone';
import { MOTION_DURATION } from '@/constants/motion';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { triggerHapticFeedback } from '@/lib/haptics';
import {
  createStudyActionGate,
  performStudyAction,
  resolveStudyOptionState,
} from '@/lib/study-interactions';
import type { AlternativeId, AnswerRecord, Difficulty, Question } from '@/types';

type QuestionCardProps = {
  question: Question;
  position: number;
  total: number;
  showPosition?: boolean;
  answer?: AnswerRecord;
  onAnswer: (question: Question, selected: AlternativeId) => void;
  onReset: (questionId: string) => void;
};

const DIFFICULTY_TONE: Record<Difficulty, Tone> = {
  'Fácil': 'success',
  'Média': 'warning',
  'Difícil': 'danger',
};

function QuestionCardComponent({
  question,
  position,
  total,
  showPosition = true,
  answer,
  onAnswer,
  onReset,
}: QuestionCardProps) {
  const { colors } = useTheme();
  const [pendingSelection, setPendingSelection] = useState<AlternativeId | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);
  const answerGate = useRef(createStudyActionGate());

  const answered = Boolean(answer);
  const chosen = answer?.selected ?? pendingSelection;
  const isCorrect = answer?.isCorrect ?? false;

  useEffect(() => {
    if (!answered) answerGate.current.reset();
  }, [answered, question.id]);

  const handleAnswer = () => {
    if (answered) return;
    if (!pendingSelection) return;
    performStudyAction({
      gate: answerGate.current,
      commit: () => {
        setShowExplanation(true);
        onAnswer(question, pendingSelection);
      },
      feedback: () => triggerHapticFeedback('confirm-answer'),
    });
  };

  const handleReset = () => {
    answerGate.current.reset();
    setPendingSelection(null);
    setShowExplanation(true);
    onReset(question.id);
  };

  const resultTone = toneColors(colors, isCorrect ? 'success' : 'danger');

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <Badge label={question.subject} tone="primary" />
          <Badge label={question.difficulty} tone={DIFFICULTY_TONE[question.difficulty]} />
        </View>
        <QuestionFavoriteButton questionId={question.id} />
      </View>

      <View style={styles.metaRail} accessibilityLabel={`Fonte da questão: ${question.board}, ${question.year}, ${question.concurso}, ${question.role}`}>
        <View style={styles.metaItem}>
          <Ionicons name="business-outline" size={15} color={colors.textSubtle} />
          <Text style={[styles.meta, { color: colors.textMuted }]}>{`${question.board} · ${question.year}`}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="briefcase-outline" size={15} color={colors.textSubtle} />
          <Text style={[styles.meta, { color: colors.textMuted }]}>{`${question.concurso} · ${question.role}`}</Text>
        </View>
      </View>

      {showPosition ? (
        <Text style={[styles.counter, { color: colors.textSubtle }]}>
          {`Questão ${position} de ${total} · ${question.topic}`}
        </Text>
      ) : null}

      <Text style={[styles.statement, { color: colors.text }]}>{question.statement}</Text>

      <View style={styles.alternatives}>
        {question.alternatives.map((alternative) => {
          const isChosen = chosen === alternative.id;
          const isRightAnswer = alternative.id === question.correct;
          const state = resolveStudyOptionState({
            selected: isChosen,
            answered,
            correct: isRightAnswer,
          });

          return (
            <StudyOption
              key={alternative.id}
              value={alternative.id}
              text={alternative.text}
              state={state}
              selected={isChosen}
              onPress={() => setPendingSelection(alternative.id)}
              disabled={answered}
            />
          );
        })}
      </View>

      {!answered ? (
        <Button
          label={pendingSelection ? `Responder alternativa ${pendingSelection}` : 'Selecione uma alternativa'}
          icon="paper-plane-outline"
          iconMotion="forward"
          onPress={handleAnswer}
          disabled={!pendingSelection}
          fullWidth
        />
      ) : (
        <View style={styles.answeredArea}>
          {question.explanation ? <Animated.View
            entering={FadeIn.duration(MOTION_DURATION.reaction).reduceMotion(ReduceMotion.System)}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.resultBanner, { backgroundColor: resultTone.background }]}>
            <Ionicons
              name={isCorrect ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={resultTone.foreground}
            />
            <Text style={[styles.resultText, { color: resultTone.foreground }]}>
              {isCorrect
                ? question.explanation
                  ? 'Resposta correta. Gabarito comentado abaixo.'
                  : 'Resposta correta.'
                : `Resposta incorreta. O gabarito é a alternativa ${question.correct}.`}
            </Text>
          </Animated.View> : null}

          <QuestionCommunityStat question={question} />

          <Animated.View
            layout={LinearTransition.duration(MOTION_DURATION.expand).reduceMotion(
              ReduceMotion.System
            )}
            style={[
              styles.explanationCard,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}>
            <Pressable
              onPress={() => setShowExplanation((current) => !current)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showExplanation }}
              aria-expanded={showExplanation}
              accessibilityLabel="Gabarito comentado"
              style={styles.explanationHeader}>
              <Ionicons name="bulb-outline" size={18} color={colors.accent} />
              <Text style={[styles.explanationTitle, { color: colors.text }]}>Gabarito comentado</Text>
              <ExpandableChevron expanded={showExplanation} color={colors.textSubtle} />
            </Pressable>

            {showExplanation ? (
              <Animated.View
                entering={FadeIn.duration(MOTION_DURATION.expand).reduceMotion(ReduceMotion.System)}
                exiting={FadeOut.duration(MOTION_DURATION.expand).reduceMotion(ReduceMotion.System)}
                style={[styles.explanationBody, { borderTopColor: colors.border }]}>
                <Text style={[styles.explanationText, { color: colors.textMuted }]}>
                  {question.explanation}
                </Text>
              </Animated.View>
            ) : null}
          </Animated.View>

          <Button
            label="Tentar novamente"
            variant="secondary"
            icon="refresh"
            iconMotion="up"
            onPress={handleReset}
          />
          <QuestionComments questionId={question.id} />
        </View>
      )}
    </View>
  );
}

export const QuestionCard = memo(QuestionCardComponent);

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  badgeGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
  },
  metaRail: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  meta: {
    flexShrink: 1,
    fontSize: FontSize.small,
    fontWeight: FontWeight.medium,
    lineHeight: 18,
  },
  counter: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.medium,
  },
  statement: {
    fontSize: FontSize.body + 1,
    lineHeight: 23,
    fontWeight: FontWeight.medium,
  },
  alternatives: {
    gap: Spacing.sm,
  },
  answeredArea: {
    gap: Spacing.sm,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  resultText: {
    flex: 1,
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    lineHeight: 19,
  },
  explanationCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  explanationTitle: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  explanationBody: {
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  explanationText: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
});
