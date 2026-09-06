export type RankingPeriod = 'today' | 'month' | 'all';

export const RANKING_PERIOD_LABELS: Record<RankingPeriod, string> = {
  today: 'hoje',
  month: 'neste mês',
  all: 'no geral',
};
