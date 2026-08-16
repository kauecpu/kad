import type { AlternativeId, EssayDocument, SimulationSession } from '../types/index.ts';

const ALTERNATIVES = new Set<AlternativeId>(['A', 'B', 'C', 'D', 'E']);

function validIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function nextSyncTimestamp(
  previous?: string,
  now = new Date().toISOString()
): string {
  const nowTime = Date.parse(now);
  const previousTime = validIsoDate(previous) ? Date.parse(previous) + 1 : 0;
  return new Date(Math.max(nowTime, previousTime)).toISOString();
}

export function simulationUpdatedAt(session: SimulationSession): string {
  if (validIsoDate(session.updatedAt)) return session.updatedAt;
  if (validIsoDate(session.completedAt)) return session.completedAt;
  return session.createdAt;
}

export function touchSimulationSession(
  session: SimulationSession,
  updatedAt = nextSyncTimestamp(session.updatedAt)
): SimulationSession {
  return { ...session, updatedAt };
}

export function isSimulationSession(value: unknown): value is SimulationSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<SimulationSession>;
  const config = session.config as Partial<SimulationSession['config']> | undefined;
  if (
    typeof session.id !== 'string' ||
    session.id.length < 1 ||
    session.id.length > 120 ||
    !['active', 'paused', 'completed'].includes(session.status ?? '') ||
    !validIsoDate(session.createdAt) ||
    !Array.isArray(session.questions) ||
    session.questions.length < 1 ||
    session.questions.length > 200 ||
    !session.answers ||
    typeof session.answers !== 'object' ||
    !Number.isInteger(session.currentIndex) ||
    (session.currentIndex ?? -1) < 0 ||
    (session.currentIndex ?? 0) >= session.questions.length ||
    !Number.isInteger(session.remainingSeconds) ||
    (session.remainingSeconds ?? -1) < 0 ||
    !config ||
    !Array.isArray(config.disciplines) ||
    !Array.isArray(config.topics) ||
    !Array.isArray(config.boards) ||
    !Array.isArray(config.years) ||
    !Array.isArray(config.difficulties) ||
    !Number.isInteger(config.questionCount) ||
    !Number.isInteger(config.durationMinutes) ||
    typeof config.shuffleQuestions !== 'boolean' ||
    typeof config.shuffleAlternatives !== 'boolean'
  ) {
    return false;
  }
  if (session.status === 'completed' && !validIsoDate(session.completedAt)) return false;
  if (session.updatedAt !== undefined && !validIsoDate(session.updatedAt)) return false;
  if (
    !session.questions.every(
      (question) =>
        question &&
        typeof question.questionId === 'string' &&
        Array.isArray(question.alternativeOrder) &&
        question.alternativeOrder.every((alternative) => ALTERNATIVES.has(alternative))
    )
  ) {
    return false;
  }
  return Object.values(session.answers).every((answer) => ALTERNATIVES.has(answer));
}

export function parseStoredSimulation(value: string | null): SimulationSession | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isSimulationSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseStoredSimulationHistory(value: string | null): SimulationSession[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isSimulationSession) : [];
  } catch {
    return [];
  }
}

export function mergeSimulationSessions(
  local: SimulationSession[],
  remote: SimulationSession[],
  historyLimit = 20
): { session: SimulationSession | null; history: SimulationSession[] } {
  const byId = new Map<string, SimulationSession>();
  for (const candidate of [...local, ...remote]) {
    if (!isSimulationSession(candidate)) continue;
    const current = byId.get(candidate.id);
    if (!current || Date.parse(simulationUpdatedAt(candidate)) >= Date.parse(simulationUpdatedAt(current))) {
      byId.set(candidate.id, candidate);
    }
  }

  const ordered = [...byId.values()].sort(
    (left, right) => Date.parse(simulationUpdatedAt(right)) - Date.parse(simulationUpdatedAt(left))
  );
  const history = ordered
    .filter((item) => item.status === 'completed')
    .slice(0, historyLimit);
  const session = ordered.find((item) => item.status !== 'completed') ?? history[0] ?? null;
  return { session, history };
}

export function parseStoredEssay(
  value: string | null,
  topicId: string,
  fallbackUpdatedAt = new Date(0).toISOString()
): EssayDocument | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (isEssayDocument(parsed) && parsed.topicId === topicId) return parsed;
  } catch {
    // O formato anterior guardava o texto puro, que normalmente não é JSON.
  }
  return {
    topicId,
    content: value,
    elapsedSeconds: 0,
    status: 'draft',
    updatedAt: fallbackUpdatedAt,
  };
}

export function isEssayDocument(value: unknown): value is EssayDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<EssayDocument>;
  return (
    typeof document.topicId === 'string' &&
    document.topicId.length >= 1 &&
    document.topicId.length <= 120 &&
    typeof document.content === 'string' &&
    document.content.length <= 30000 &&
    Number.isInteger(document.elapsedSeconds) &&
    (document.elapsedSeconds ?? -1) >= 0 &&
    (document.elapsedSeconds ?? 86401) <= 86400 &&
    (document.status === 'draft' || document.status === 'submitted') &&
    validIsoDate(document.updatedAt) &&
    (document.status === 'submitted'
      ? validIsoDate(document.submittedAt)
      : document.submittedAt === undefined)
  );
}

export function newestEssay(
  local: EssayDocument | null,
  remote: EssayDocument | null
): EssayDocument | null {
  if (!local) return remote;
  if (!remote) return local;
  return Date.parse(remote.updatedAt) >= Date.parse(local.updatedAt) ? remote : local;
}
