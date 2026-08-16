export function accuracyFromCounts(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((correct / total) * 100)));
}

export type CommunityAccuracySummary =
  | { hasSample: false; valueLabel: 'Ainda sem dados'; detailLabel: string }
  | { hasSample: true; valueLabel: string; detailLabel: string };

export function communityAccuracySummary(
  accuracy: number,
  totalAnswers: number
): CommunityAccuracySummary {
  if (!Number.isFinite(totalAnswers) || totalAnswers <= 0) {
    return {
      hasSample: false,
      valueLabel: 'Ainda sem dados',
      detailLabel: 'A taxa aparecerá quando houver respostas suficientes.',
    };
  }

  const safeAccuracy = Math.max(0, Math.min(100, Math.round(accuracy)));
  return {
    hasSample: true,
    valueLabel: `${safeAccuracy}%`,
    detailLabel: `Baseado em ${totalAnswers} ${totalAnswers === 1 ? 'resposta' : 'respostas'}`,
  };
}
