import type { ConcursoPack, Question, SiteAnswer } from '../types/domain.ts';

export function escapeHtml(value: unknown = ''): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
export function normalizeText(value: unknown = ''): string {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function slugify(value: unknown = ''): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)].filter(Boolean);
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function formatPercent(value: number): string {
  return `${Math.round(Number.isFinite(value) ? value : 0)}%`;
}

export function formatCount(count: number, singular: string, plural: string): string {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return `${safeCount.toLocaleString('pt-BR')} ${safeCount === 1 ? singular : plural}`;
}

export function formatCurrency(value?: number | null): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function formatDate(value?: unknown): string {
  if (!value) return 'A definir';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'A definir';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function randomId(prefix = 'item'): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function initials(name = ''): string {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'K';
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts.at(-1)?.[0] ?? '' : ''}`.toUpperCase();
}

export function queryParams(search = globalThis.location?.search ?? ''): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search));
}

export function questionsPerformance(answers?: Record<string, SiteAnswer> | null) {
  const records = Object.values(answers ?? {});
  const correct = records.filter((answer) => answer.isCorrect).length;
  const total = records.length;
  return {
    total,
    correct,
    wrong: total - correct,
    accuracy: total ? (correct / total) * 100 : 0,
  };
}

export function groupPerformance(questions: readonly Question[], answers?: Record<string, SiteAnswer> | null) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const grouped = new Map();
  for (const record of Object.values(answers ?? {})) {
    const question = byId.get(record.questionId);
    if (!question) continue;
    const current = grouped.get(question.discipline) ?? { total: 0, correct: 0 };
    current.total += 1;
    current.correct += record.isCorrect ? 1 : 0;
    grouped.set(question.discipline, current);
  }
  return [...grouped.entries()]
    .map(([name, value]) => ({
      name,
      ...value,
      accuracy: value.total ? (value.correct / value.total) * 100 : 0,
    }))
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, 'pt-BR'));
}

export function matchesPack(question?: Question | null, pack?: ConcursoPack | null): boolean {
  if (!question || !pack) return false;
  const scope = pack.questionScope ?? {};
  const includes = (value: string, terms: string[] = []) => {
    const normalized = normalizeText(value);
    return terms.some((term) => normalized.includes(normalizeText(term)));
  };
  return pack.disciplines.includes(question.discipline) && (
    includes(question.institution, scope.institutions) ||
    includes(question.concurso, scope.concursos) ||
    includes(question.role, scope.roles)
  );
}

export type QuestionFilter = {
  keyword?: string;
  discipline?: string;
  topic?: string;
  board?: string;
  difficulty?: string;
  year?: string | number;
  pack?: ConcursoPack;
};

export function filterQuestions(questions: readonly Question[], filters: QuestionFilter = {}): Question[] {
  const keyword = normalizeText(filters.keyword);
  return questions.filter((question) => {
    if (filters.discipline && question.discipline !== filters.discipline) return false;
    if (filters.topic && question.topic !== filters.topic) return false;
    if (filters.board && question.board !== filters.board) return false;
    if (filters.difficulty && question.difficulty !== filters.difficulty) return false;
    if (filters.year && question.year !== Number(filters.year)) return false;
    if (filters.pack && !matchesPack(question, filters.pack)) return false;
    if (!keyword) return true;
    return normalizeText([
      question.statement,
      question.discipline,
      question.subject,
      question.topic,
      question.board,
      question.role,
      question.institution,
      question.concurso,
    ].join(' ')).includes(keyword);
  });
}

export function shuffle<T>(values: readonly T[]): T[] {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}
