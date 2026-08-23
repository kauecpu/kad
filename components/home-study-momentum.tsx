import Ionicons from '@/components/ui/app-icon';
import { type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { FontSize, FontWeight, Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatRecentStudyTime,
  WEEKLY_QUESTION_GOAL_OPTIONS,
  type RecentStudyActivity,
  type StudyMomentum,
} from '@/lib/study-momentum';

type StudyMomentumCardProps = {
  momentum: StudyMomentum;
  onGoalChange: (goal: number) => void;
};

type RecentStudyCardProps = {
  activities: RecentStudyActivity[];
  onOpen: (route: Href) => void;
  onStart: () => void;
};

export function StudyMomentumCard({ momentum, onGoalChange }: StudyMomentumCardProps) {
  const { colors } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const [editingGoal, setEditingGoal] = useState(false);
  const stackGoalHeading = width < 360 || fontScale >= 1.3;
  const streakLabel =
    momentum.streakDays === 0
      ? 'Comece sua sequência hoje'
      : `${momentum.streakDays} ${momentum.streakDays === 1 ? 'dia seguido' : 'dias seguidos'}`;

  return (
    <Card padded={false} style={[styles.momentumCard, { borderColor: colors.border }]}>
      <View style={[styles.momentumTop, { backgroundColor: colors.primarySoft }]}>
        <View style={[styles.goalHeading, stackGoalHeading && styles.goalHeadingStacked]}>
          <View style={styles.goalIdentity}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.goalIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="flag-outline" size={18} color={colors.onPrimary} aria-hidden />
            </View>
            <View style={styles.goalCopy}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>META SEMANAL</Text>
              <Text style={[styles.goalTitle, { color: colors.text }]}>
                {momentum.weeklyQuestions} de {momentum.weeklyGoal} questões
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => setEditingGoal((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel="Ajustar meta semanal"
            accessibilityState={{ expanded: editingGoal }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.adjustButton,
              stackGoalHeading && styles.adjustButtonStacked,
              { backgroundColor: colors.surface },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.adjustText, { color: colors.primary }]}>Ajustar</Text>
          </Pressable>
        </View>

        <ProgressBar
          value={momentum.weeklyProgress}
          color={colors.primary}
          height={7}
          label={`Meta semanal: ${momentum.weeklyQuestions} de ${momentum.weeklyGoal} questões`}
        />

        {editingGoal ? (
          <View style={styles.goalOptions} accessibilityRole="radiogroup">
            {WEEKLY_QUESTION_GOAL_OPTIONS.map((goal) => {
              const selected = goal === momentum.weeklyGoal;
              return (
                <Pressable
                  key={goal}
                  onPress={() => {
                    onGoalChange(goal);
                    setEditingGoal(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={`${goal} questões por semana`}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.goalOption,
                    {
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderColor: selected ? colors.primary : colors.borderStrong,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.goalOptionText,
                      { color: selected ? colors.onPrimary : colors.text },
                    ]}>
                    {goal}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.momentumBottom}>
        <View style={styles.streakRow}>
          <View style={[styles.streakIcon, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="flame-outline" size={18} color={colors.warning} />
          </View>
          <View style={styles.streakCopy}>
            <Text style={[styles.streakTitle, { color: colors.text }]}>{streakLabel}</Text>
            <Text style={[styles.streakDescription, { color: colors.textMuted }]}>
              Um dia conta quando você responde uma questão ou conclui um simulado.
            </Text>
          </View>
        </View>

        <View style={styles.weekRail} accessibilityLabel="Atividade nesta semana">
          {momentum.weekDays.map((day) => (
            <View
              key={day.dateKey}
              accessible
              accessibilityLabel={`${day.label}, dia ${day.dayNumber}: ${day.active ? 'com estudo' : 'sem estudo'}`}
              style={styles.weekDay}>
              <Text
                style={[
                  styles.weekLabel,
                  { color: day.today ? colors.primary : colors.textSubtle },
                ]}>
                {day.label}
              </Text>
              <View
                style={[
                  styles.dayMarker,
                  {
                    backgroundColor: day.active ? colors.primary : colors.surfaceAlt,
                    borderColor: day.today ? colors.primary : colors.border,
                  },
                ]}>
                {day.active ? (
                  <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.dayNumber, { color: colors.textMuted }]}>
                    {day.dayNumber}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

export function RecentStudyCard({ activities, onOpen, onStart }: RecentStudyCardProps) {
  const { colors } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const stackEmpty = width < 360 || fontScale >= 1.3;

  if (activities.length === 0) {
    return (
      <Card
        style={[
          styles.emptyRecent,
          stackEmpty && styles.emptyRecentStacked,
          { borderColor: colors.border },
        ]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="time-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.emptyCopy}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Seu histórico começa aqui</Text>
          <Text style={[styles.emptyDescription, { color: colors.textMuted }]}>
            Faça o desafio diário para registrar sua primeira atividade.
          </Text>
        </View>
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel="Fazer desafio diário"
          style={({ pressed }) => [
            styles.startButton,
            stackEmpty && styles.startButtonStacked,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.startText, { color: colors.onPrimary }]}>Desafio</Text>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card padded={false} style={[styles.recentCard, { borderColor: colors.border }]}>
      {activities.map((activity, index) => {
        const questionTone = activity.correct ? colors.success : colors.danger;
        const iconColor = activity.kind === 'simulation' ? colors.primary : questionTone;
        const iconBackground =
          activity.kind === 'simulation'
            ? colors.primarySoft
            : activity.correct
              ? colors.successSoft
              : colors.dangerSoft;
        return (
          <Pressable
            key={activity.id}
            onPress={() => onOpen(activity.route as Href)}
            accessibilityRole="button"
            accessibilityLabel={`${activity.title}. ${activity.description}`}
            style={({ pressed }) => [
              styles.recentRow,
              index < activities.length - 1 && {
                borderBottomColor: colors.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.activityIcon, { backgroundColor: iconBackground }]}>
              <Ionicons
                name={activity.kind === 'simulation' ? 'timer-outline' : 'reader-outline'}
                size={19}
                color={iconColor}
              />
            </View>
            <View style={styles.activityCopy}>
              <View style={styles.activityHeading}>
                <Text style={[styles.activityTitle, { color: colors.text }]}>
                  {activity.title}
                </Text>
                <Text style={[styles.activityTime, { color: colors.textSubtle }]}>
                  {formatRecentStudyTime(activity.occurredAt)}
                </Text>
              </View>
              <Text style={[styles.activityDescription, { color: colors.textMuted }]}>
                {activity.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  momentumCard: { overflow: 'hidden', borderWidth: 1 },
  momentumTop: { padding: Spacing.lg, gap: Spacing.md },
  goalHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  goalHeadingStacked: { alignItems: 'stretch', flexDirection: 'column' },
  goalIdentity: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCopy: { flex: 1, gap: 2 },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.7,
  },
  goalTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  adjustButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  adjustButtonStacked: { alignSelf: 'flex-start' },
  adjustText: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  goalOptions: { flexDirection: 'row', gap: Spacing.sm },
  goalOption: {
    minWidth: 62,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  goalOptionText: { fontFamily: Fonts.mono, fontSize: FontSize.small, fontWeight: FontWeight.bold },
  momentumBottom: { padding: Spacing.lg, gap: Spacing.lg },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  streakIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCopy: { flex: 1, gap: 2 },
  streakTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  streakDescription: { fontSize: FontSize.tiny, lineHeight: 16 },
  weekRail: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.xs },
  weekDay: { flex: 1, alignItems: 'center', gap: 6 },
  weekLabel: { fontFamily: Fonts.mono, fontSize: 9, fontWeight: FontWeight.bold },
  dayMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: { fontFamily: Fonts.mono, fontSize: FontSize.tiny, fontWeight: FontWeight.semibold },
  recentCard: { overflow: 'hidden', borderWidth: 1 },
  recentRow: {
    minHeight: 72,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCopy: { flex: 1, gap: 4 },
  activityHeading: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: Spacing.sm },
  activityTitle: { flex: 1, fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  activityTime: { fontSize: FontSize.tiny },
  activityDescription: { fontSize: FontSize.tiny, lineHeight: 16 },
  emptyRecent: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyRecentStacked: { alignItems: 'flex-start', flexDirection: 'column' },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: { flex: 1, gap: 3 },
  emptyTitle: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  emptyDescription: { fontSize: FontSize.tiny, lineHeight: 16 },
  startButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  startButtonStacked: { alignSelf: 'flex-start' },
  startText: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  pressed: { opacity: 0.68 },
});
