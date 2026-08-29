import type { AlternativeId, EssayDocument, SiteSimulationSession } from '../types/domain.ts';

const ALTERNATIVES = new Set<AlternativeId>(['A', 'B', 'C', 'D', 'E']);

export function validIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function nextSyncTimestamp(previous?: string, now = new Date().toISOString()): string {
  const nowTime = Date.parse(now);
  const previousTime = validIsoDate(previous) ? Date.parse(previous) + 1 : 0;
  return new Date(Math.max(nowTime, previousTime)).toISOString();
}

export function simulationUpdatedAt(session: SiteSimulationSession): string {
  if (validIsoDate(session.updatedAt)) return session.updatedAt;
  if (validIsoDate(session.completedAt)) return session.completedAt;
  return session.createdAt;
}

export function touchSimulationSession(session: SiteSimulationSession): SiteSimulationSession {
  return { ...session, updatedAt: nextSyncTimestamp(session.updatedAt) };
}

export function isSimulationSession(value: unknown): value is SiteSimulationSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<SiteSimulationSession>;
  const config = session.config as Partial<SiteSimulationSession['config']> | undefined;
  if (
    typeof session.id !== 'string'
    || session.id.length < 1
    || session.id.length > 120
    || !['active', 'paused', 'completed'].includes(session.status ?? '')
    || !validIsoDate(session.createdAt)
    || !Array.isArray(session.questions)
    || session.questions.length < 1
    || session.questions.length > 200
    || !session.answers
    || typeof session.answers !== 'object'
    || !Number.isInteger(session.currentIndex)
    || (session.currentIndex ?? -1) < 0
    || (session.currentIndex ?? 0) >= session.questions.length
    || !Number.isInteger(session.remainingSeconds)
    || (session.remainingSeconds ?? -1) < 0
    || !config
    || !Array.isArray(config.disciplines)
    || !Array.isArray(config.topics)
    || !Array.isArray(config.boards)
    || !Array.isArray(config.years)
    || !Array.isArray(config.difficulties)
    || !Number.isInteger(config.questionCount)
    || !Number.isInteger(config.durationMinutes)
    || typeof config.shuffleQuestions !== 'boolean'
    || typeof config.shuffleAlternatives !== 'boolean'
  ) return false;

  if (session.status === 'completed' && !validIsoDate(session.completedAt)) return false;
  if (session.updatedAt !== undefined && !validIsoDate(session.updatedAt)) return false;
  if (!session.questions.every((question) => question
    && typeof question.questionId === 'string'
    && Array.isArray(question.alternativeOrder)
    && question.alternativeOrder.every((alternative) => ALTERNATIVES.has(alternative)))) return false;
  return Object.values(session.answers).every((answer) => ALTERNATIVES.has(answer));
}

export function mergeSimulationSessions(
  local: SiteSimulationSession[],
  remote: SiteSimulationSession[],
  historyLimit = 20,
): { current: SiteSimulationSession | null; history: SiteSimulationSession[] } {
  const byId = new Map<string, SiteSimulationSession>();
  for (const candidate of [...local, ...remote]) {
    if (!isSimulationSession(candidate)) continue;
    const current = byId.get(candidate.id);
    if (!current || Date.parse(simulationUpdatedAt(candidate)) >= Date.parse(simulationUpdatedAt(current))) {
      byId.set(candidate.id, candidate);
    }
  }
  const ordered = [...byId.values()].sort(
    (left, right) => Date.parse(simulationUpdatedAt(right)) - Date.parse(simulationUpdatedAt(left)),
  );
  return {
    current: ordered.find((item) => item.status !== 'completed') ?? ordered.find((item) => item.status === 'completed') ?? null,
    history: ordered.filter((item) => item.status === 'completed').slice(0, historyLimit),
  };
}

export function isEssayDocument(value: unknown): value is EssayDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<EssayDocument>;
  return typeof document.topicId === 'string'
    && document.topicId.length >= 1
    && document.topicId.length <= 120
    && typeof document.content === 'string'
    && document.content.length <= 30_000
    && Number.isInteger(document.elapsedSeconds)
    && (document.elapsedSeconds ?? -1) >= 0
    && (document.elapsedSeconds ?? 86_401) <= 86_400
    && (document.status === 'draft' || document.status === 'submitted')
    && validIsoDate(document.updatedAt)
    && (document.status === 'submitted' ? validIsoDate(document.submittedAt) : document.submittedAt === undefined);
}

export function mergeEssayDocuments(
  local: Record<string, EssayDocument>,
  remote: EssayDocument[],
): Record<string, EssayDocument> {
  const merged = { ...local };
  for (const document of remote) {
    if (!isEssayDocument(document)) continue;
    const current = merged[document.topicId];
    if (!current || Date.parse(document.updatedAt) >= Date.parse(current.updatedAt)) {
      merged[document.topicId] = document;
    }
  }
  return merged;
}
