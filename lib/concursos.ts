import type { Tone } from '@/components/ui/tone';
import { daysUntil } from './format.ts';
import { normalizeSearchText } from './text.ts';
import type { Concurso, ConcursoPack, ConcursoStatus } from '@/types';

export type StatusFilter = ConcursoStatus | 'todos';
export type ConcursoSort = 'deadline' | 'salary' | 'vacancies' | 'updated';
export type SalaryRange = 'until-3000' | '3000-6000' | '6000-10000' | 'above-10000';
export type ConcursoFilterKey = 'boards' | 'states' | 'levels' | 'roles' | 'salaryRanges';
export type ConcursoFilters = Record<ConcursoFilterKey, string[]>;

export const EMPTY_CONCURSO_FILTERS: ConcursoFilters = {
  boards: [],
  states: [],
  levels: [],
  roles: [],
  salaryRanges: [],
};

export const STATUS_LABEL: Record<ConcursoStatus, string> = {
  aberto: 'Inscrições abertas',
  previsto: 'Edital previsto',
  encerrado: 'Inscrições encerradas',
};

/** Busca por órgão, sigla, cargo, banca, estado, cidade e cargos internos. */
export function searchConcursos(concursos: Concurso[], query: string): Concurso[] {
  const term = normalizeSearchText(query);
  if (!term) return concursos;

  return concursos.filter((concurso) => {
    const haystack = [
      concurso.organ,
      concurso.shortName,
      concurso.title,
      concurso.board,
      concurso.state,
      concurso.city ?? '',
      concurso.region,
      ...concurso.levels,
      ...concurso.roles.map((role) => role.name),
    ]
      .map(normalizeSearchText)
      .join(' ');

    return haystack.includes(term);
  });
}

/** Ordena uma cópia da lista sem alterar os dados originais. */
export function sortConcursos(concursos: Concurso[], sort: ConcursoSort): Concurso[] {
  const sorted = [...concursos];

  return sorted.sort((a, b) => {
    if (sort === 'salary') return b.salaryMax - a.salaryMax;
    if (sort === 'vacancies') return b.vacancies - a.vacancies;
    if (sort === 'updated') {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeDeadline = (date?: string) => {
      if (!date) return Number.POSITIVE_INFINITY;
      const timestamp = new Date(`${date}T12:00:00`).getTime();
      return timestamp >= today.getTime() ? timestamp : Number.POSITIVE_INFINITY;
    };
    const aDeadline = activeDeadline(a.registrationEnd);
    const bDeadline = activeDeadline(b.registrationEnd);
    return aDeadline - bDeadline;
  });
}

export function matchesSalaryRanges(concurso: Concurso, ranges: SalaryRange[]): boolean {
  if (ranges.length === 0) return true;

  return ranges.some((range) => {
    if (range === 'until-3000') return concurso.salaryMax <= 3000;
    if (range === '3000-6000') return concurso.salaryMax > 3000 && concurso.salaryMax <= 6000;
    if (range === '6000-10000') return concurso.salaryMax > 6000 && concurso.salaryMax <= 10000;
    return concurso.salaryMax > 10000;
  });
}

export function filterByStatus(concursos: Concurso[], status: StatusFilter): Concurso[] {
  if (status === 'todos') return concursos;
  return concursos.filter((concurso) => concurso.status === status);
}

/** Prioriza concursos cujo Ã³rgÃ£o ou cargo corresponde Ã  meta informada no perfil. */
export function recommendConcursosForGoal(concursos: Concurso[], goal: string): Concurso[] {
  const ignored = new Set(['para', 'com', 'dos', 'das', 'de', 'do', 'da', 'e']);
  const tokens = normalizeSearchText(goal)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !ignored.has(token));
  if (tokens.length === 0) return [];

  return concursos
    .map((concurso) => {
      const haystack = normalizeSearchText(
        [concurso.organ, concurso.shortName, concurso.title, ...concurso.roles.map((role) => role.name)].join(' ')
      );
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { concurso, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.concurso.salaryMax - a.concurso.salaryMax)
    .map(({ concurso }) => concurso);
}

/** Liga um edital real aos pacotes de questÃµes e trilhas jÃ¡ existentes. */
export function findStudyPackForConcurso(
  concurso: Concurso,
  packs: ConcursoPack[]
): ConcursoPack | undefined {
  const text = normalizeSearchText(
    `${concurso.shortName} ${concurso.organ} ${concurso.title} ${concurso.roles.map((role) => role.name).join(' ')}`
  );

  const packId = text.includes('banco do brasil')
    ? 'banco-do-brasil'
    : text.includes('policia federal')
      ? 'policia-federal'
      : text.includes('inss') || text.includes('seguro social')
        ? 'inss'
        : text.includes('fazenda') || text.includes('fiscal') || text.includes('tributaria')
          ? 'area-fiscal'
          : text.includes('prefeitura') || text.includes('professor') || text.includes('educacao')
            ? 'prefeituras-educacao'
            : text.includes('tribunal') || text.includes('judiciario')
              ? 'tribunais'
              : text.includes('nacional unificado')
                ? 'cnu'
                : undefined;

  return packId ? packs.find((pack) => pack.id === packId) : undefined;
}

export type DeadlineInfo = {
  label: string;
  tone: Tone;
  icon: 'time-outline' | 'calendar-outline' | 'checkmark-done-outline' | 'hourglass-outline';
};

/** Rótulo do prazo de inscrição exibido no cartão e na tela de detalhes. */
export function deadlineInfo(concurso: Concurso): DeadlineInfo {
  if (concurso.status === 'previsto') {
    return { label: 'Edital previsto', tone: 'accent', icon: 'hourglass-outline' };
  }

  if (concurso.status === 'encerrado') {
    return { label: 'Inscrições encerradas', tone: 'neutral', icon: 'checkmark-done-outline' };
  }

  const remaining = daysUntil(concurso.registrationEnd);
  if (remaining === null) {
    return { label: 'Inscrições abertas', tone: 'success', icon: 'calendar-outline' };
  }

  if (remaining < 0) {
    return { label: 'Prazo encerrado', tone: 'neutral', icon: 'checkmark-done-outline' };
  }

  if (remaining === 0) {
    return { label: 'Último dia de inscrição', tone: 'danger', icon: 'time-outline' };
  }

  if (remaining <= 7) {
    return {
      label: `Encerra em ${remaining} ${remaining === 1 ? 'dia' : 'dias'}`,
      tone: 'warning',
      icon: 'time-outline',
    };
  }

  return { label: `Encerra em ${remaining} dias`, tone: 'success', icon: 'calendar-outline' };
}
