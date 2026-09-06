import type { RankingPeriod } from '../data/ranking.ts';

export type RankingEntry = {
  name: string;
  username: string | null;
  points: number;
  level: number;
  activityCount: number;
  rank: number;
};

export type CurrentRankingEntry = RankingEntry & { isPublic: boolean };

export type RankingSnapshot = {
  period: RankingPeriod;
  entries: RankingEntry[];
  currentUser: CurrentRankingEntry | null;
  totalParticipants: number;
  limit: number;
  offset: number;
};

const integer = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function entry(value: unknown, current = false): RankingEntry | CurrentRankingEntry | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.name !== 'string' || (item.username !== null && typeof item.username !== 'string') ||
    !integer(item.points) || !integer(item.level) || !integer(item.activityCount) ||
    !integer(item.rank) || item.rank === 0
  ) return null;
  const base: RankingEntry = {
    name: item.name,
    username: item.username as string | null,
    points: item.points as number,
    level: item.level as number,
    activityCount: item.activityCount as number,
    rank: item.rank as number,
  };
  return current ? { ...base, isPublic: item.isPublic === true } : base;
}

export function parseRankingSnapshot(value: unknown): RankingSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Resposta inválida do ranking.');
  const data = value as Record<string, unknown>;
  if (!['today', 'month', 'all'].includes(String(data.period)) || !Array.isArray(data.entries)) throw new Error('Resposta inválida do ranking.');
  const entries = data.entries.map(item => entry(item)).filter((item): item is RankingEntry => Boolean(item));
  if (entries.length !== data.entries.length || !integer(data.totalParticipants) || !integer(data.limit) || !integer(data.offset)) throw new Error('Resposta inválida do ranking.');
  const currentUser = data.currentUser === null ? null : entry(data.currentUser, true) as CurrentRankingEntry | null;
  if (data.currentUser !== null && !currentUser) throw new Error('Resposta inválida do ranking.');
  return { period: data.period as RankingPeriod, entries, currentUser, totalParticipants: data.totalParticipants as number, limit: data.limit as number, offset: data.offset as number };
}

export function rankingInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toLocaleUpperCase('pt-BR') ?? '').join('') || 'K';
}
