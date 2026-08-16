import type { AnswerRecord } from '../types/index.ts';
import type { TrailLevel } from './trails.ts';
import { normalizeSearchText } from './text.ts';

export type TrailMode = 'concurso' | 'discipline';

export type TrailSelection = {
  mode: TrailMode;
  trackId: string;
  level: number;
};

export type TrailCatalog = Record<TrailMode, Record<string, number[]>>;

const TRAIL_SELECTION_STORAGE_PREFIX = '@kad/trails/selection/v1';

export function trailSelectionStorageKey(ownerId: string): string {
  return `${TRAIL_SELECTION_STORAGE_PREFIX}:${ownerId}`;
}

export function parseTrailSelection(value: string | null): TrailSelection | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<TrailSelection>;
    if (
      (parsed.mode !== 'concurso' && parsed.mode !== 'discipline') ||
      typeof parsed.trackId !== 'string' ||
      parsed.trackId.length === 0 ||
      !Number.isInteger(parsed.level) ||
      Number(parsed.level) < 1
    ) {
      return null;
    }
    return parsed as TrailSelection;
  } catch {
    return null;
  }
}

export function resolveTrailSelection({
  stored,
  recommendedTrackId,
  catalog,
}: {
  stored: TrailSelection | null;
  recommendedTrackId?: string;
  catalog: TrailCatalog;
}): TrailSelection | null {
  if (stored) {
    const levels = catalog[stored.mode][stored.trackId];
    if (levels?.length) {
      return {
        ...stored,
        level: levels.includes(stored.level) ? stored.level : levels[0],
      };
    }
  }

  if (recommendedTrackId) {
    const levels = catalog.concurso[recommendedTrackId];
    if (levels?.length) {
      return { mode: 'concurso', trackId: recommendedTrackId, level: levels[0] };
    }
  }

  return null;
}

export function filterTrailTracks<T extends { name: string }>(tracks: T[], query: string): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return tracks;
  return tracks.filter((track) => normalizeSearchText(track.name).includes(normalizedQuery));
}

export function trailLevelMetrics(
  level: TrailLevel,
  answers: Record<string, AnswerRecord>
) {
  const records = level.questions
    .map((question) => answers[question.id])
    .filter((answer): answer is AnswerRecord => Boolean(answer));
  const answered = records.length;
  const correct = records.filter((answer) => answer.isCorrect).length;
  const total = level.questions.length;

  return {
    answered,
    correct,
    total,
    accuracy: answered > 0 ? (correct / answered) * 100 : 0,
    completed: total > 0 && answered === total,
  };
}

export function trailMetrics(
  levels: TrailLevel[],
  answers: Record<string, AnswerRecord>
) {
  const availableLevels = levels.filter((level) => level.questions.length > 0);
  const metrics = availableLevels.map((level) => trailLevelMetrics(level, answers));
  const answered = metrics.reduce((total, item) => total + item.answered, 0);
  const correct = metrics.reduce((total, item) => total + item.correct, 0);
  const total = metrics.reduce((sum, item) => sum + item.total, 0);

  return {
    availableLevels,
    answered,
    correct,
    total,
    accuracy: answered > 0 ? (correct / answered) * 100 : 0,
    completedLevels: metrics.filter((item) => item.completed).length,
    progress: total > 0 ? (answered / total) * 100 : 0,
  };
}
