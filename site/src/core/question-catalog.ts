import { CONCURSO_PACKS } from '../../../data/exam-concursos.ts';
import type { ConcursoPack, Question } from '../types/domain.ts';

const FALLBACK_COLORS = ['#6D28D9', '#0E7490', '#0E9F6E', '#C0392B', '#C9A227'];

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value: unknown): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sem-valor';
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function groupName(concurso: string, institution: string, role: string): string {
  const normalizedConcurso = normalize(concurso);
  const normalizedRole = normalize(role);
  const isReceita = normalizedConcurso === 'rfb22' || normalizedRole.includes('receita federal');
  const base = isReceita ? 'Receita Federal' : looksLikeUuid(concurso) ? institution : concurso;
  return role ? `${base} · ${role}` : base;
}

function stableColor(key: string): string {
  const hash = Array.from(key).reduce(
    (total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0,
    0,
  );
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

export function buildQuestionPacks(questions: Question[], published: boolean): ConcursoPack[] {
  if (!published || questions.length === 0) return CONCURSO_PACKS;
  const groups = new Map<string, Question[]>();
  for (const question of questions) {
    const key = [question.concurso, question.institution, question.board, question.year, question.role]
      .map(normalize)
      .join('\u001f');
    groups.set(key, [...(groups.get(key) ?? []), question]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const ordered = [...new Map(group.map((question) => [question.id, question])).values()]
      .sort((left, right) => left.id.localeCompare(right.id));
    const first = ordered[0];
    return {
      id: `published-${[first.concurso, first.institution, first.board, first.year, first.role].map(slug).join('--')}`,
      name: groupName(first.concurso, first.institution, first.role),
      subtitle: `${first.year} · ${first.board}`,
      icon: 'briefcase-outline',
      color: stableColor(key),
      kind: 'concurso' as const,
      disciplines: uniqueSorted(ordered.map((question) => question.discipline)),
      questionScope: {},
      questionIds: ordered.map((question) => question.id),
      metadataMissing: true,
      goalKeywords: uniqueSorted([first.role, first.concurso, first.institution]),
    };
  }).sort((left, right) => left.name.localeCompare(right.name, 'pt-BR') || left.id.localeCompare(right.id));
}
