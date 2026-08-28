import type { RankingParticipantSeed, RankingPeriod } from '../data/ranking.ts';
import { questionMatchesPack } from './simulations.ts';
import type { AnswerRecord, ConcursoPack, Difficulty, Question } from '../types/index.ts';

export const RANKING_POINTS: Record<Difficulty, number> = {
  Fácil: 1,
  Média: 2,
  Difícil: 3,
};

export type RankingEntry = {
  id: string;
  name: string;
  username: string;
  initials: string;
  points: number;
  correct: number;
  accuracy: number;
  streak: number;
  isCurrentUser: boolean;
  rank: number;
};

export type LocalRankingScore = {
  points: number;
  correct: number;
  answered: number;
  accuracy: number;
};

function localDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function answerBelongsToPeriod(
  answeredAt: string,
  period: RankingPeriod,
  now = new Date(),
): boolean {
  if (period === 'all') return true;
  const answerDate = answeredAt.slice(0, 10);
  const today = localDate(now);
  return period === 'today'
    ? answerDate === today
    : answerDate.slice(0, 7) === today.slice(0, 7);
}

export function localRankingScore({
  answers,
  questions,
  packs,
  period,
  packId,
  now = new Date(),
}: {
  answers: Record<string, AnswerRecord>;
  questions: Question[];
  packs: ConcursoPack[];
  period: RankingPeriod;
  packId: string;
  now?: Date;
}): LocalRankingScore {
  const pack = packId === 'all' ? undefined : packs.find((item) => item.id === packId);
  const eligibleQuestions = questions.filter((question) => !pack || questionMatchesPack(question, pack));
  const eligibleIds = new Set(eligibleQuestions.map((question) => question.id));
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const records = Object.values(answers).filter(
    (answer) => eligibleIds.has(answer.questionId) && answerBelongsToPeriod(answer.answeredAt, period, now),
  );
  const correctRecords = records.filter((answer) => answer.isCorrect);
  const points = correctRecords.reduce((total, answer) => {
    const question = questionById.get(answer.questionId);
    return total + (question?.difficulty ? RANKING_POINTS[question.difficulty] : 0);
  }, 0);

  return {
    points,
    correct: correctRecords.length,
    answered: records.length,
    accuracy: records.length > 0 ? (correctRecords.length / records.length) * 100 : 0,
  };
}

function stablePackFactor(participant: RankingParticipantSeed, packId: string): number {
  if (participant.specialties.includes(packId)) return 0.56;
  const hash = `${participant.id}:${packId}`
    .split('')
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  return 0.17 + (hash % 8) / 100;
}

export function buildRanking({
  participants,
  period,
  packId,
  currentUser,
}: {
  participants: RankingParticipantSeed[];
  period: RankingPeriod;
  packId: string;
  currentUser: Omit<RankingEntry, 'rank' | 'isCurrentUser'>;
}): RankingEntry[] {
  const entries: Omit<RankingEntry, 'rank'>[] = participants.map((participant) => {
    const basePoints = participant.basePoints[period];
    const points = packId === 'all'
      ? basePoints
      : Math.round(basePoints * stablePackFactor(participant, packId));

    return {
      id: participant.id,
      name: participant.name,
      username: participant.username,
      initials: participant.initials,
      points,
      correct: Math.round(points / 1.85),
      accuracy: participant.accuracy,
      streak: participant.streak,
      isCurrentUser: false,
    };
  });

  entries.push({ ...currentUser, isCurrentUser: true });

  return entries
    .sort((left, right) => right.points - left.points || right.accuracy - left.accuracy)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
