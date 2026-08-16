import { DISCIPLINES } from '../data/disciplines.ts';
import { QUESTIONS } from '../data/questions.ts';
import { normalizeSearchText } from './text.ts';
import type { AnswerRecord, Question, QuestionSearch } from '@/types';

export const EMPTY_SEARCH: QuestionSearch = {
  keyword: '',
  disciplines: [],
  topics: [],
  boards: [],
  roles: [],
  years: [],
  difficulties: [],
  institutions: [],
  answered: 'all',
  result: 'all',
};

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

const byPt = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

/** Opções de filtro derivadas dos dados simulados. */
export function searchOptionsForQuestions(questions: Question[]) {
  return {
  disciplines: DISCIPLINES.map((d) => d.name),
  topics: unique(questions.map((q) => q.topic)).sort(byPt),
  boards: unique(questions.map((q) => q.board)).sort(byPt),
  roles: unique(questions.map((q) => q.role)).sort(byPt),
  institutions: unique(questions.map((q) => q.institution)).sort(byPt),
  years: unique(questions.map((q) => q.year)).sort((a, b) => b - a),
  difficulties: ['Fácil', 'Média', 'Difícil'],
  };
}

export const SEARCH_OPTIONS = searchOptionsForQuestions(QUESTIONS);

/** Retorna somente assuntos que possuem questões nas disciplinas selecionadas. */
export function topicsForDisciplines(
  disciplines: string[],
  questions: Question[] = QUESTIONS,
): string[] {
  const topics = questions.filter(
    (question) => disciplines.length === 0 || disciplines.includes(question.discipline)
  ).map((question) => question.topic);
  return unique(topics).sort(byPt);
}

/** Quantidade total de filtros ativos (para o botão "Limpar filtros"). */
export function countSearchFilters(search: QuestionSearch): number {
  return (
    (search.keyword.trim() ? 1 : 0) +
    search.disciplines.length +
    search.topics.length +
    search.boards.length +
    search.roles.length +
    search.years.length +
    search.difficulties.length +
    search.institutions.length +
    (search.answered !== 'all' ? 1 : 0) +
    (search.result !== 'all' ? 1 : 0)
  );
}

/** Aplica todos os filtros da busca ao banco simulado de questões. */
export function searchQuestions(
  search: QuestionSearch,
  answers: Record<string, AnswerRecord>,
  questions: Question[] = QUESTIONS,
): Question[] {
  const keyword = normalizeSearchText(search.keyword);

  return questions.filter((question) => {
    if (search.disciplines.length > 0 && !search.disciplines.includes(question.discipline)) return false;
    if (search.topics.length > 0 && !search.topics.includes(question.topic)) return false;
    if (search.boards.length > 0 && !search.boards.includes(question.board)) return false;
    if (search.roles.length > 0 && !search.roles.includes(question.role)) return false;
    if (search.years.length > 0 && !search.years.includes(question.year)) return false;
    if (search.difficulties.length > 0 && !search.difficulties.includes(question.difficulty)) return false;
    if (search.institutions.length > 0 && !search.institutions.includes(question.institution)) return false;

    const record = answers[question.id];
    if (search.answered === 'answered' && !record) return false;
    if (search.answered === 'unanswered' && record) return false;
    if (search.result === 'correct' && !(record && record.isCorrect)) return false;
    if (search.result === 'wrong' && !(record && !record.isCorrect)) return false;

    if (keyword) {
      const haystack = [
        question.statement,
        question.topic,
        question.subject,
        question.discipline,
        question.board,
        question.institution,
        question.concurso,
        question.role,
      ]
        .join(' ');
      const normalizedHaystack = normalizeSearchText(haystack);
      if (!normalizedHaystack.includes(keyword)) return false;
    }

    return true;
  });
}
