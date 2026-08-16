import { localDateKey } from './access-rules.ts';
import type { AnswerRecord, Question, SimulationSession } from '../types/index.ts';

export const DEFAULT_WEEKLY_QUESTION_GOAL = 25;
export const WEEKLY_QUESTION_GOAL_OPTIONS = [10, 25, 50] as const;

export type RecentStudyActivity = {
  id: string;
  kind: 'question' | 'simulation';
  occurredAt: string;
  title: string;
  description: string;
  route: string;
  correct?: boolean;
};

export type StudyWeekDay = {
  dateKey: string;
  label: string;
  dayNumber: number;
  active: boolean;
  today: boolean;
};

export type StudyMomentum = {
  weeklyGoal: number;
  weeklyQuestions: number;
  weeklyProgress: number;
  streakDays: number;
  weekDays: StudyWeekDay[];
  recentActivities: RecentStudyActivity[];
};

type StudyMomentumInput = {
  answers: Record<string, AnswerRecord>;
  questionActivityByDate?: Record<string, number>;
  simulationHistory: SimulationSession[];
  questions: Question[];
  weeklyGoal?: number;
  now?: Date;
  recentLimit?: number;
};

const WEEKDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const;

export function questionActivityCountsFromAnswers(
  answers: Record<string, AnswerRecord>
): Record<string, number> {
  return Object.values(answers).reduce<Record<string, number>>((counts, answer) => {
    const date = validDate(answer.answeredAt);
    if (!date) return counts;
    const dateKey = localDateKey(date);
    counts[dateKey] = (counts[dateKey] ?? 0) + 1;
    return counts;
  }, {});
}

export function mergeQuestionActivityCounts(
  current: Record<string, number>,
  answers: Record<string, AnswerRecord>
): Record<string, number> {
  const fromAnswers = questionActivityCountsFromAnswers(answers);
  const merged = { ...current };
  for (const [dateKey, count] of Object.entries(fromAnswers)) {
    merged[dateKey] = Math.max(merged[dateKey] ?? 0, count);
  }
  return merged;
}

export function recordQuestionStudyActivity(
  current: Record<string, number>,
  now = new Date()
): Record<string, number> {
  const dateKey = localDateKey(now);
  return { ...current, [dateKey]: (current[dateKey] ?? 0) + 1 };
}

export function normalizeWeeklyQuestionGoal(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_WEEKLY_QUESTION_GOAL;
  }
  return Math.max(5, Math.min(200, Math.round(value)));
}

function validDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalWeek(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function addLocalDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function isDuringCurrentWeek(date: Date, weekStart: Date): boolean {
  const nextWeek = addLocalDays(weekStart, 7);
  return date.getTime() >= weekStart.getTime() && date.getTime() < nextWeek.getTime();
}

function currentStreak(activeDates: Set<string>, now: Date): number {
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!activeDates.has(localDateKey(cursor))) cursor = addLocalDays(cursor, -1);

  let streak = 0;
  while (activeDates.has(localDateKey(cursor))) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
}

function questionActivity(
  answer: AnswerRecord,
  question: Question | undefined
): RecentStudyActivity {
  const discipline = question?.discipline ?? answer.subject;
  const topic = question?.topic ?? answer.subject;
  return {
    id: `question:${answer.questionId}`,
    kind: 'question',
    occurredAt: answer.answeredAt,
    title: discipline,
    description: `${topic} · ${answer.isCorrect ? 'Resposta correta' : 'Revisar resposta'}`,
    route: question
      ? `/questoes/${encodeURIComponent(question.discipline)}/${encodeURIComponent(question.topic)}`
      : '/questoes',
    correct: answer.isCorrect,
  };
}

function simulationActivity(session: SimulationSession): RecentStudyActivity {
  const answered = Object.keys(session.answers).length;
  return {
    id: `simulation:${session.id}`,
    kind: 'simulation',
    occurredAt: session.completedAt ?? session.createdAt,
    title: 'Simulado concluído',
    description: `${answered} de ${session.questions.length} questões respondidas`,
    route: '/simulados',
  };
}

export function buildStudyMomentum({
  answers,
  questionActivityByDate,
  simulationHistory,
  questions,
  weeklyGoal,
  now = new Date(),
  recentLimit = 3,
}: StudyMomentumInput): StudyMomentum {
  const safeGoal = normalizeWeeklyQuestionGoal(weeklyGoal);
  const weekStart = startOfLocalWeek(now);
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const activeDates = new Set<string>();
  let weeklyQuestions = 0;

  const questionCounts =
    questionActivityByDate ?? questionActivityCountsFromAnswers(answers);
  for (const [dateKey, count] of Object.entries(questionCounts)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(count) || count <= 0) {
      continue;
    }
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    activeDates.add(dateKey);
    if (isDuringCurrentWeek(date, weekStart)) weeklyQuestions += Math.floor(count);
  }

  const answerActivities = Object.values(answers).flatMap((answer) => {
    const date = validDate(answer.answeredAt);
    if (!date) return [];
    return [questionActivity(answer, questionsById.get(answer.questionId))];
  });

  const simulationActivities = simulationHistory.flatMap((session) => {
    if (session.status !== 'completed') return [];
    const date = validDate(session.completedAt ?? session.createdAt);
    const answered = Object.keys(session.answers).length;
    if (!date || answered === 0) return [];
    activeDates.add(localDateKey(date));
    if (isDuringCurrentWeek(date, weekStart)) weeklyQuestions += answered;
    return [simulationActivity(session)];
  });

  const todayKey = localDateKey(now);
  const weekDays = WEEKDAY_LABELS.map((label, index) => {
    const date = addLocalDays(weekStart, index);
    const dateKey = localDateKey(date);
    return {
      dateKey,
      label,
      dayNumber: date.getDate(),
      active: activeDates.has(dateKey),
      today: dateKey === todayKey,
    };
  });

  const recentActivities = [...answerActivities, ...simulationActivities]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, Math.max(0, recentLimit));

  return {
    weeklyGoal: safeGoal,
    weeklyQuestions,
    weeklyProgress: Math.min(100, (weeklyQuestions / safeGoal) * 100),
    streakDays: currentStreak(activeDates, now),
    weekDays,
    recentActivities,
  };
}

export function formatRecentStudyTime(value: string, now = new Date()): string {
  const date = validDate(value);
  if (!date) return '';
  const dateKey = localDateKey(date);
  const todayKey = localDateKey(now);
  const yesterdayKey = localDateKey(addLocalDays(now, -1));
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (dateKey === todayKey) return `Hoje, ${time}`;
  if (dateKey === yesterdayKey) return `Ontem, ${time}`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}
