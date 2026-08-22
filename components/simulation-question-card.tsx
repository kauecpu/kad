import Ionicons from '@/components/ui/app-icon';
import { StyleSheet, Text, View } from 'react-native';

import { QuestionCommunityStat } from '@/components/question-community-stat';
import { QuestionFavoriteButton } from '@/components/question-favorite-button';
import { Badge } from '@/components/ui/badge';
import { StudyOption } from '@/components/ui/study-option';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { canonicalAlternativeOrder } from '@/lib/simulations';
import { resolveStudyOptionState } from '@/lib/study-interactions';
import type { AlternativeId, Question } from '@/types';

type SimulationQuestionCardProps = {
  question: Question;
  alternativeOrder: AlternativeId[];
  selected?: AlternativeId;
  onSelect: (alternative: AlternativeId) => void;
};

export function SimulationQuestionCard({
  question,
  alternativeOrder,
  selected,
  onSelect,
}: SimulationQuestionCardProps) {
  const { colors } = useTheme();
  const displayLetters = canonicalAlternativeOrder();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.badges}>
          <Badge label={question.subject} tone="primary" />
          <Badge label={question.difficulty} tone="neutral" />
        </View>
        <QuestionFavoriteButton questionId={question.id} />
      </View>

      <Text style={[styles.meta, { color: colors.textSubtle }]}>
        {`${question.board} · ${question.year} · ${question.topic}`}
      </Text>
      <Text style={[styles.statement, { color: colors.text }]}>{question.statement}</Text>

      <View style={styles.alternatives}>
        {alternativeOrder.map((alternativeId, index) => {
          const alternative = question.alternatives.find((item) => item.id === alternativeId);
          if (!alternative) return null;
          const isSelected = selected === alternativeId;
          const displayLetter = displayLetters[index] ?? alternativeId;

          return (
            <StudyOption
              key={alternativeId}
              value={alternativeId}
              displayLetter={displayLetter}
              text={alternative.text}
              state={resolveStudyOptionState({
                selected: isSelected,
                answered: false,
                correct: false,
              })}
              selected={isSelected}
              onPress={() => onSelect(alternativeId)}
            />
          );
        })}
      </View>
    </View>
  );
}

type SimulationReviewCardProps = {
  question: Question;
  alternativeOrder: AlternativeId[];
  selected?: AlternativeId;
};

export function SimulationReviewCard({
  question,
  alternativeOrder,
  selected,
}: SimulationReviewCardProps) {
  const { colors } = useTheme();
  const displayLetters = canonicalAlternativeOrder();
  const correct = selected === question.correct;

  return (
    <View
      style={[
        styles.reviewCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      <View style={styles.reviewHeader}>
        <View style={styles.badges}>
          <Badge label={question.subject} tone="primary" />
          <Badge
            label={correct ? 'Acertou' : selected ? 'Errou' : 'Em branco'}
            tone={correct ? 'success' : selected ? 'danger' : 'neutral'}
            icon={
              correct ? 'checkmark-circle' : selected ? 'close-circle' : 'remove-circle-outline'
            }
          />
        </View>
        <QuestionFavoriteButton questionId={question.id} />
      </View>

      <Text style={[styles.reviewStatement, { color: colors.text }]}>{question.statement}</Text>

      <View style={styles.reviewAlternatives}>
        {alternativeOrder.map((alternativeId, index) => {
          const alternative = question.alternatives.find((item) => item.id === alternativeId);
          if (!alternative) return null;
          const isCorrect = alternativeId === question.correct;
          const isSelected = alternativeId === selected;
          const displayLetter = displayLetters[index] ?? alternativeId;

          return (
            <View
              key={alternativeId}
              style={[
                styles.reviewAlternative,
                {
                  backgroundColor: isCorrect
                    ? colors.successSoft
                    : isSelected
                      ? colors.dangerSoft
                      : colors.surfaceAlt,
                  borderColor: isCorrect
                    ? colors.success
                    : isSelected
                      ? colors.danger
                      : colors.border,
                },
              ]}>
              <Text
                style={[
                  styles.reviewLetter,
                  {
                    color: isCorrect
                      ? colors.success
                      : isSelected
                        ? colors.danger
                        : colors.textMuted,
                  },
                ]}>
                {displayLetter}
              </Text>
              <Text style={[styles.reviewText, { color: colors.textMuted }]}>
                {alternative.text}
              </Text>
              {isCorrect ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              ) : isSelected ? (
                <Ionicons name="close-circle" size={18} color={colors.danger} />
              ) : null}
            </View>
          );
        })}
      </View>

      <QuestionCommunityStat question={question} />

      <View
        style={[
          styles.explanation,
          { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
        ]}>
        <Ionicons name="bulb-outline" size={18} color={colors.accent} />
        <Text style={[styles.explanationText, { color: colors.textMuted }]}>
          {question.explanation}
        </Text>
      </View>
    </View>
  );
}

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
  badges: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  meta: {
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
  reviewCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  reviewStatement: {
    fontSize: FontSize.body,
    lineHeight: 22,
    fontWeight: FontWeight.medium,
  },
  reviewAlternatives: {
    gap: Spacing.sm,
  },
  reviewAlternative: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  reviewLetter: {
    width: 20,
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  reviewText: {
    flex: 1,
    fontSize: FontSize.small,
    lineHeight: 19,
  },
  explanation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  explanationText: {
    flex: 1,
    fontSize: FontSize.small,
    lineHeight: 20,
  },
});
