import Ionicons from '@/components/ui/app-icon';
import { memo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { QuestionComments } from '@/components/question-comments';
import { QuestionCommunityStat } from '@/components/question-community-stat';
import { QuestionFavoriteButton } from '@/components/question-favorite-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toneColors, type Tone } from '@/components/ui/tone';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AlternativeId, AnswerRecord, Difficulty, Question } from '@/types';

type QuestionCardProps = {
  question: Question;
  position: number;
  total: number;
  answer?: AnswerRecord;
  canAnswer?: boolean;
  onLimitReached?: () => void;
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
  answer,
  canAnswer = true,
  onLimitReached,
  onAnswer,
  onReset,
}: QuestionCardProps) {
  const { colors } = useTheme();
  const [pendingSelection, setPendingSelection] = useState<AlternativeId | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);

  const answered = Boolean(answer);
  const chosen = answer?.selected ?? pendingSelection;
  const isCorrect = answer?.isCorrect ?? false;

  const handleAnswer = () => {
    if (answered) return;
    if (!canAnswer) {
      Alert.alert(
        'Limite diário atingido',
        'O plano Básico permite responder até 10 questões por dia. Sua cota será renovada amanhã.',
        [
          { text: 'Agora não', style: 'cancel' },
          ...(onLimitReached
            ? [{ text: 'Ver planos', onPress: onLimitReached }]
            : []),
        ]
      );
      return;
    }
    if (!pendingSelection) return;
    setShowExplanation(true);
    onAnswer(question, pendingSelection);
  };

  const handleReset = () => {
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
          {answered ? (
            <Badge
              label={isCorrect ? 'Acertou' : 'Errou'}
              tone={isCorrect ? 'success' : 'danger'}
              icon={isCorrect ? 'checkmark-circle' : 'close-circle'}
            />
          ) : null}
        </View>
        <QuestionFavoriteButton questionId={question.id} />
      </View>

      <Text style={[styles.meta, { color: colors.textSubtle }]}>
        {`${question.board} · ${question.year} · ${question.concurso} · ${question.role}`}
      </Text>

      <Text style={[styles.counter, { color: colors.textMuted }]}>
        {`Questão ${position} de ${total} · ${question.topic}`}
      </Text>

      <Text style={[styles.statement, { color: colors.text }]}>{question.statement}</Text>

      <View style={styles.alternatives}>
        {question.alternatives.map((alternative) => {
          const isChosen = chosen === alternative.id;
          const isRightAnswer = alternative.id === question.correct;

          let borderColor = colors.border;
          let background = colors.surface;
          let letterBackground = colors.surfaceAlt;
          let letterColor = colors.textMuted;
          let textColor = colors.text;

          if (answered) {
            if (isRightAnswer) {
              borderColor = colors.success;
              background = colors.successSoft;
              letterBackground = colors.success;
              letterColor = colors.surface;
            } else if (isChosen) {
              borderColor = colors.danger;
              background = colors.dangerSoft;
              letterBackground = colors.danger;
              letterColor = colors.surface;
            } else {
              textColor = colors.textMuted;
            }
          } else if (isChosen) {
            borderColor = colors.primary;
            background = colors.primarySoft;
            letterBackground = colors.primary;
            letterColor = colors.onPrimary;
          }

          return (
            <Pressable
              key={alternative.id}
              onPress={() => setPendingSelection(alternative.id)}
              disabled={answered}
              accessibilityRole="radio"
              accessibilityState={{ checked: isChosen, disabled: answered }}
              accessibilityLabel={`Alternativa ${alternative.id}: ${alternative.text}`}
              style={({ pressed }) => [
                styles.alternative,
                { borderColor, backgroundColor: background },
                pressed && !answered && { opacity: 0.75 },
              ]}>
              <View style={[styles.letter, { backgroundColor: letterBackground }]}>
                <Text style={[styles.letterText, { color: letterColor }]}>{alternative.id}</Text>
              </View>
              <Text style={[styles.alternativeText, { color: textColor }]}>{alternative.text}</Text>
              {answered && isRightAnswer ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              ) : null}
              {answered && isChosen && !isRightAnswer ? (
                <Ionicons name="close-circle" size={18} color={colors.danger} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {!answered ? (
        <Button
          label={
            !canAnswer
              ? 'Limite atingido · ver planos'
              : pendingSelection
                ? `Responder alternativa ${pendingSelection}`
                : 'Selecione uma alternativa'
          }
          icon={canAnswer ? 'paper-plane-outline' : 'lock-closed-outline'}
          onPress={handleAnswer}
          disabled={!pendingSelection && canAnswer}
          fullWidth
        />
      ) : (
        <View style={styles.answeredArea}>
          <View style={[styles.resultBanner, { backgroundColor: resultTone.background }]}>
            <Ionicons
              name={isCorrect ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={resultTone.foreground}
            />
            <Text style={[styles.resultText, { color: resultTone.foreground }]}>
              {isCorrect
                ? 'Resposta correta. Gabarito comentado abaixo.'
                : `Resposta incorreta. O gabarito é a alternativa ${question.correct}.`}
            </Text>
          </View>

          <QuestionCommunityStat question={question} />

          <Pressable
            onPress={() => setShowExplanation((current) => !current)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showExplanation }}
            accessibilityLabel="Gabarito comentado"
            style={[
              styles.explanationHeader,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}>
            <Ionicons name="bulb-outline" size={17} color={colors.accent} />
            <Text style={[styles.explanationTitle, { color: colors.text }]}>Gabarito comentado</Text>
            <Ionicons
              name={showExplanation ? 'chevron-up' : 'chevron-down'}
              size={17}
              color={colors.textSubtle}
            />
          </Pressable>

          {showExplanation ? (
            <View
              style={[
                styles.explanationBody,
                { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
              ]}>
              <Text style={[styles.explanationText, { color: colors.textMuted }]}>
                {question.explanation}
              </Text>
            </View>
          ) : null}

          <Button label="Refazer questão" variant="ghost" icon="refresh" onPress={handleReset} />
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
  meta: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.2,
  },
  counter: {
    fontSize: FontSize.tiny,
    marginTop: -Spacing.sm,
  },
  statement: {
    fontSize: FontSize.body + 1,
    lineHeight: 23,
    fontWeight: FontWeight.medium,
  },
  alternatives: {
    gap: Spacing.sm,
  },
  alternative: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  letter: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  alternativeText: {
    flex: 1,
    fontSize: FontSize.body,
    lineHeight: 21,
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
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  explanationTitle: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  explanationBody: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  explanationText: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
});
