import { CONCURSO_PACKS } from '../data/exam-concursos.ts';
import type { ConcursoPack, Question } from '../types/index.ts';

export type QuestionCatalogSource = 'demo' | 'cache' | 'published';

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
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sem-valor';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stableColor(key: string): string {
  const hash = Array.from(key).reduce(
    (total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0,
    0,
  );
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function groupKey(question: Question): string {
  return [question.concurso, question.institution, question.board, String(question.year), question.role]
    .map(normalize)
    .join('\u001f');
}

function groupName(concurso: string, institution: string, role: string): string {
  const normalizedConcurso = normalize(concurso);
  const normalizedRole = normalize(role);
  const isReceita = normalizedConcurso === 'rfb22' || normalizedRole.includes('receita federal');
  const base = isReceita ? 'Receita Federal' : looksLikeUuid(concurso) ? institution : concurso;
  return role ? `${base} · ${role}` : base;
}

/**
 * Retorna os grupos que devem aparecer para a fonte atual do conteúdo.
 * Conteúdo publicado usa grupos derivados das próprias questões; o catálogo
 * estático só é usado enquanto o app ainda está no acervo demonstrativo.
 */
export function buildQuestionPacks(
  questions: Question[],
  source: QuestionCatalogSource,
): ConcursoPack[] {
  if (source === 'demo' || questions.length === 0) return CONCURSO_PACKS;

  const groups = new Map<string, Question[]>();
  for (const question of questions) {
    const key = groupKey(question);
    const current = groups.get(key) ?? [];
    current.push(question);
    groups.set(key, current);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
    .map(([key, group]) => {
      const ordered = Array.from(new Map(group.map((question) => [question.id, question])).values())
        .sort((a, b) => a.id.localeCompare(b.id));
      const first = ordered[0];
      const id = `published-${[first.concurso, first.institution, first.board, first.year, first.role]
        .map(slug)
        .join('--')}`;
      return {
        id,
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
      } as ConcursoPack;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id));
}

export function questionPackDisciplines(
  questions: Question[],
  source: QuestionCatalogSource,
): string[] {
  if (source === 'demo') {
    return CONCURSO_PACKS.flatMap((pack) => pack.disciplines);
  }
  return uniqueSorted(questions.map((question) => question.discipline));
}
