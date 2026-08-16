import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ui/progress-bar';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { communityAccuracySummary } from '@/lib/accuracy';
import {
  communityAccuracyForQuestion,
  type CommunityAccuracy,
} from '@/lib/question-community-stats';
import { useAuth } from '@/providers/auth-provider';
import type { Question } from '@/types';

type QuestionCommunityStatProps = {
  question: Question;
};

export function QuestionCommunityStat({ question }: QuestionCommunityStatProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [stat, setStat] = useState<CommunityAccuracy | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!user) {
      setStat(null);
      return;
    }
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setUnavailable(false);

    const load = async (allowRetry: boolean) => {
      try {
        const result = await communityAccuracyForQuestion(question.id);
        if (!active) return;
        if (!result && allowRetry) {
          retry = setTimeout(() => load(false), 700);
          return;
        }
        setStat(result);
        setLoading(false);
      } catch {
        if (active) {
          setUnavailable(true);
          setLoading(false);
        }
      }
    };

    load(true);
    return () => {
      active = false;
      if (retry) clearTimeout(retry);
    };
  }, [question.id, user]);

  if (!user) return null;
  if (loading && !stat) {
    return <Text style={[styles.status, { color: colors.textSubtle }]}>Calculando taxa de acerto...</Text>;
  }
  if (unavailable || !stat) {
    return <Text style={[styles.status, { color: colors.textSubtle }]}>Taxa de acerto indisponível.</Text>;
  }

  const { accuracy, totalAnswers } = stat;
  const summary = communityAccuracySummary(accuracy, totalAnswers);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Acerto entre estudantes</Text>
        <Text
          style={[
            summary.hasSample ? styles.value : styles.emptyValue,
            { color: summary.hasSample ? colors.primary : colors.textSubtle },
          ]}>
          {summary.valueLabel}
        </Text>
      </View>
      {summary.hasSample ? (
        <ProgressBar
          value={accuracy}
          color={colors.primary}
          label={`${summary.valueLabel} de acerto. ${summary.detailLabel}`}
        />
      ) : null}
      <Text style={[styles.detail, { color: colors.textSubtle }]}>{summary.detailLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  label: { fontSize: FontSize.small, fontWeight: FontWeight.medium },
  value: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  emptyValue: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  detail: { fontSize: FontSize.tiny, lineHeight: 16 },
  status: { paddingVertical: Spacing.xs, fontSize: FontSize.small },
});
