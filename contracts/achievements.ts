import { levelProgress, type LevelLedger } from './levels.ts';

export type AchievementCategory = 'questions' | 'accuracy' | 'streak' | 'simulations' | 'flashcards' | 'levels';
export type AchievementMetric = 'distinct_questions' | 'distinct_correct' | 'longest_streak' | 'simulations_completed' | 'flashcard_reviews' | 'level';

export type AchievementDefinition = {
  key: string;
  category: AchievementCategory;
  metric: AchievementMetric;
  title: string;
  description: string;
  threshold: number;
  icon: string;
  sortOrder: number;
};

export type AchievementProgress = AchievementDefinition & {
  value: number;
  progress: number;
  unlockedAt: string | null;
};

export type AchievementUnlock = Pick<AchievementProgress, 'key' | 'category' | 'title' | 'description' | 'icon' | 'unlockedAt'>;

export type GamificationMetrics = {
  distinctQuestions: number;
  distinctCorrect: number;
  longestStreak: number;
  simulationsCompleted: number;
  flashcardReviews: number;
  level: number;
};

export const ACHIEVEMENT_CATEGORIES: { value: AchievementCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'questions', label: 'Questões' },
  { value: 'accuracy', label: 'Acertos' },
  { value: 'streak', label: 'Sequência' },
  { value: 'simulations', label: 'Simulados' },
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'levels', label: 'Níveis' },
];

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  { key: 'primeiro_passo', category: 'questions', metric: 'distinct_questions', title: 'Primeiro passo', description: 'Responda sua primeira questão.', threshold: 1, icon: 'footsteps-outline', sortOrder: 10 },
  { key: 'aquecimento', category: 'questions', metric: 'distinct_questions', title: 'Aquecimento', description: 'Responda 10 questões diferentes.', threshold: 10, icon: 'flame-outline', sortOrder: 20 },
  { key: 'ritmo_firme', category: 'questions', metric: 'distinct_questions', title: 'Ritmo firme', description: 'Responda 50 questões diferentes.', threshold: 50, icon: 'walk-outline', sortOrder: 30 },
  { key: 'centenario', category: 'questions', metric: 'distinct_questions', title: 'Centenário', description: 'Responda 100 questões diferentes.', threshold: 100, icon: 'ribbon-outline', sortOrder: 40 },
  { key: 'maratonista_250', category: 'questions', metric: 'distinct_questions', title: 'Maratonista', description: 'Responda 250 questões diferentes.', threshold: 250, icon: 'fitness-outline', sortOrder: 50 },
  { key: 'meio_milhar', category: 'questions', metric: 'distinct_questions', title: 'Meio milhar', description: 'Responda 500 questões diferentes.', threshold: 500, icon: 'medal-outline', sortOrder: 60 },
  { key: 'mil_questoes', category: 'questions', metric: 'distinct_questions', title: 'Mil questões', description: 'Responda 1.000 questões diferentes.', threshold: 1000, icon: 'trophy-outline', sortOrder: 70 },
  { key: 'dez_acertos', category: 'accuracy', metric: 'distinct_correct', title: 'Na direção certa', description: 'Acerte 10 questões diferentes.', threshold: 10, icon: 'checkmark-circle-outline', sortOrder: 110 },
  { key: 'cem_acertos', category: 'accuracy', metric: 'distinct_correct', title: 'Precisão', description: 'Acerte 100 questões diferentes.', threshold: 100, icon: 'locate-outline', sortOrder: 120 },
  { key: 'quinhentos_acertos', category: 'accuracy', metric: 'distinct_correct', title: 'Domínio', description: 'Acerte 500 questões diferentes.', threshold: 500, icon: 'shield-checkmark-outline', sortOrder: 130 },
  { key: 'sequencia_3', category: 'streak', metric: 'longest_streak', title: 'Três dias', description: 'Estude por 3 dias consecutivos.', threshold: 3, icon: 'calendar-outline', sortOrder: 210 },
  { key: 'sequencia_7', category: 'streak', metric: 'longest_streak', title: 'Uma semana', description: 'Estude por 7 dias consecutivos.', threshold: 7, icon: 'calendar-number-outline', sortOrder: 220 },
  { key: 'sequencia_30', category: 'streak', metric: 'longest_streak', title: 'Um mês de constância', description: 'Estude por 30 dias consecutivos.', threshold: 30, icon: 'flame-outline', sortOrder: 230 },
  { key: 'sequencia_100', category: 'streak', metric: 'longest_streak', title: 'Cem dias', description: 'Estude por 100 dias consecutivos.', threshold: 100, icon: 'infinite-outline', sortOrder: 240 },
  { key: 'primeiro_simulado', category: 'simulations', metric: 'simulations_completed', title: 'Primeiro simulado', description: 'Conclua um simulado válido.', threshold: 1, icon: 'stopwatch-outline', sortOrder: 310 },
  { key: 'simulados_10', category: 'simulations', metric: 'simulations_completed', title: 'Treino de prova', description: 'Conclua 10 simulados válidos.', threshold: 10, icon: 'timer-outline', sortOrder: 320 },
  { key: 'simulados_50', category: 'simulations', metric: 'simulations_completed', title: 'Veterano de simulados', description: 'Conclua 50 simulados válidos.', threshold: 50, icon: 'podium-outline', sortOrder: 330 },
  { key: 'flashcards_10', category: 'flashcards', metric: 'flashcard_reviews', title: 'Memória ativa', description: 'Faça 10 revisões válidas de flashcards.', threshold: 10, icon: 'albums-outline', sortOrder: 410 },
  { key: 'flashcards_100', category: 'flashcards', metric: 'flashcard_reviews', title: 'Revisão constante', description: 'Faça 100 revisões válidas de flashcards.', threshold: 100, icon: 'layers-outline', sortOrder: 420 },
  { key: 'flashcards_500', category: 'flashcards', metric: 'flashcard_reviews', title: 'Memória de longo prazo', description: 'Faça 500 revisões válidas de flashcards.', threshold: 500, icon: 'library-outline', sortOrder: 430 },
  { key: 'nivel_10', category: 'levels', metric: 'level', title: 'Nível 10', description: 'Alcance o nível 10.', threshold: 10, icon: 'star-outline', sortOrder: 510 },
  { key: 'nivel_25', category: 'levels', metric: 'level', title: 'Nível 25', description: 'Alcance o nível 25.', threshold: 25, icon: 'star-half-outline', sortOrder: 520 },
  { key: 'nivel_50', category: 'levels', metric: 'level', title: 'Nível 50', description: 'Alcance o nível 50.', threshold: 50, icon: 'star-outline', sortOrder: 530 },
  { key: 'nivel_75', category: 'levels', metric: 'level', title: 'Nível 75', description: 'Alcance o nível 75.', threshold: 75, icon: 'sparkles-outline', sortOrder: 540 },
  { key: 'nivel_100', category: 'levels', metric: 'level', title: 'Nível 100', description: 'Alcance o nível máximo.', threshold: 100, icon: 'diamond-outline', sortOrder: 550 },
];

function longestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let longest = 0;
  let current = 0;
  let previous = Number.NaN;
  for (const day of sorted) {
    const value = Date.parse(`${day}T12:00:00Z`) / 86400000;
    current = value === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = value;
  }
  return longest;
}

export function metricsFromLedger(ledger: LevelLedger): GamificationMetrics {
  const validQuestions = ledger.entries.filter(entry =>
    (entry.kind === 'question' || entry.kind === 'review') && typeof entry.isCorrect === 'boolean'
  );
  const firstByQuestion = new Map<string, (typeof validQuestions)[number]>();
  for (const entry of validQuestions) {
    if (!firstByQuestion.has(entry.itemId)) firstByQuestion.set(entry.itemId, entry);
  }
  const firstQuestions = [...firstByQuestion.values()];
  const validCompleted = (reason: string) => reason === 'earned' || reason === 'daily_limit';
  return {
    distinctQuestions: firstQuestions.length,
    distinctCorrect: firstQuestions.filter(entry => entry.isCorrect).length,
    longestStreak: longestStreak(ledger.entries.filter(entry => entry.xp > 0).map(entry => entry.day)),
    simulationsCompleted: new Set(ledger.entries.filter(entry => entry.kind === 'simulation' && validCompleted(entry.reason)).map(entry => entry.itemId)).size,
    flashcardReviews: ledger.entries.filter(entry => entry.kind === 'flashcard' && validCompleted(entry.reason)).length,
    level: levelProgress(ledger.totalXp).level,
  };
}

export function achievementProgress(metrics: GamificationMetrics, unlocked: Record<string, string> = {}): AchievementProgress[] {
  const valueFor = (metric: AchievementMetric) => ({
    distinct_questions: metrics.distinctQuestions,
    distinct_correct: metrics.distinctCorrect,
    longest_streak: metrics.longestStreak,
    simulations_completed: metrics.simulationsCompleted,
    flashcard_reviews: metrics.flashcardReviews,
    level: metrics.level,
  })[metric];
  return ACHIEVEMENT_CATALOG.map(definition => {
    const value = valueFor(definition.metric);
    return { ...definition, value, progress: Math.min(1, value / definition.threshold), unlockedAt: unlocked[definition.key] ?? null };
  });
}

export function achievementsFromLedger(ledger: LevelLedger): AchievementProgress[] {
  const metrics = metricsFromLedger(ledger);
  const unlockedAt = ledger.entries.at(-1)?.at ?? new Date(0).toISOString();
  return achievementProgress(metrics, Object.fromEntries(
    ACHIEVEMENT_CATALOG.filter(item => ({
      distinct_questions: metrics.distinctQuestions,
      distinct_correct: metrics.distinctCorrect,
      longest_streak: metrics.longestStreak,
      simulations_completed: metrics.simulationsCompleted,
      flashcard_reviews: metrics.flashcardReviews,
      level: metrics.level,
    })[item.metric] >= item.threshold).map(item => [item.key, unlockedAt]),
  ));
}

export function nextLockedAchievement(items: AchievementProgress[]): AchievementProgress | null {
  return items.filter(item => !item.unlockedAt).sort((left, right) => right.progress - left.progress || left.sortOrder - right.sortOrder)[0] ?? null;
}
