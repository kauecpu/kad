import type { Question, QuestionFilters } from '@/types';

export const EMPTY_FILTERS: QuestionFilters = {
  subjects: [],
  boards: [],
  years: [],
  roles: [],
};



/** Alterna a presença de um valor em uma lista de filtros (multi-seleção). */
export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function countActiveFilters(filters: QuestionFilters): number {
  return (
    filters.subjects.length + filters.boards.length + filters.years.length + filters.roles.length
  );
}

/** Uma dimensão vazia não restringe o resultado; dimensões diferentes se combinam com E. */
export function filterQuestions(questions: Question[], filters: QuestionFilters): Question[] {
  return questions.filter((question) => {
    if (filters.subjects.length > 0 && !filters.subjects.includes(question.subject)) return false;
    if (filters.boards.length > 0 && !filters.boards.includes(question.board)) return false;
    if (filters.years.length > 0 && !filters.years.includes(question.year)) return false;
    if (filters.roles.length > 0 && !filters.roles.includes(question.role)) return false;
    return true;
  });
}
