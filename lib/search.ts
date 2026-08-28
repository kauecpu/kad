import { DISCIPLINES } from '../data/disciplines.ts';
import { QUESTIONS } from '../data/questions.ts';
import { normalizeSearchText } from './text.ts';
import type { AnswerRecord, EducationLevel, Question, QuestionSearch } from '@/types';

export const EMPTY_SEARCH: QuestionSearch = {
  keyword: '',
  disciplines: [],
  subjects: [],
  topics: [],
  boards: [],
  roles: [],
  years: [],
  difficulties: [],
  institutions: [],
  concursos: [],
  levels: [],
  answered: 'all',
  result: 'all',
};

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

const byPt = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

/** Opções de filtro derivadas dos dados simulados. */
export function searchOptionsForQuestions(questions: Question[]) {
  const availableDisciplines = new Set(questions.map((question) => question.discipline));
  const levelOrder: EducationLevel[] = ['Fundamental', 'Médio', 'Superior'];

  return {
    disciplines: DISCIPLINES.map((discipline) => discipline.name).filter((name) =>
      availableDisciplines.has(name)
    ),
    subjects: unique(questions.map((question) => question.subject)).sort(byPt),
    topics: unique(questions.map((question) => question.topic)).sort(byPt),
    boards: unique(questions.map((question) => question.board)).sort(byPt),
    roles: unique(questions.map((question) => question.role)).sort(byPt),
    institutions: unique(questions.map((question) => question.institution)).sort(byPt),
    concursos: unique(questions.map((question) => question.concurso)).sort(byPt),
    years: unique(questions.map((question) => question.year)).sort((a, b) => b - a),
    levels: levelOrder.filter((level) => questions.some((question) => question.level === level)),
    difficulties: ['Fácil', 'Média', 'Difícil'].filter((difficulty) =>
      questions.some((question) => question.difficulty === difficulty)
    ),
  };
}

export const SEARCH_OPTIONS = searchOptionsForQuestions(QUESTIONS);

/** Retorna somente matérias que possuem questões nas disciplinas selecionadas. */
export function subjectsForDisciplines(
  disciplines: string[],
  questions: Question[] = QUESTIONS,
): string[] {
  const subjects = questions
    .filter(
      (question) => disciplines.length === 0 || disciplines.includes(question.discipline)
    )
    .map((question) => question.subject);
  return unique(subjects).sort(byPt);
}

/** Retorna assuntos compatíveis com a disciplina e a matéria selecionadas. */
export function topicsForSelection(
  disciplines: string[],
  subjects: string[],
  questions: Question[] = QUESTIONS,
): string[] {
  const topics = questions
    .filter(
      (question) =>
        (disciplines.length === 0 || disciplines.includes(question.discipline)) &&
        (subjects.length === 0 || subjects.includes(question.subject))
    )
    .map((question) => question.topic);
  return unique(topics).sort(byPt);
}

/** Compatibilidade para jornadas que filtram assuntos apenas por disciplina. */
export function topicsForDisciplines(
  disciplines: string[],
  questions: Question[] = QUESTIONS,
): string[] {
  return topicsForSelection(disciplines, [], questions);
}

/** Quantidade total de filtros ativos (para o botão "Limpar filtros"). */
export function countSearchFilters(search: QuestionSearch): number {
  return (
    (search.keyword.trim() ? 1 : 0) +
    search.disciplines.length +
    search.subjects.length +
    search.topics.length +
    search.boards.length +
    search.roles.length +
    search.years.length +
    search.difficulties.length +
    search.institutions.length +
    search.concursos.length +
    search.levels.length +
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
    if (search.subjects.length > 0 && !search.subjects.includes(question.subject)) return false;
    if (search.topics.length > 0 && !search.topics.includes(question.topic)) return false;
    if (search.boards.length > 0 && !search.boards.includes(question.board)) return false;
    if (search.roles.length > 0 && !search.roles.includes(question.role)) return false;
    if (search.years.length > 0 && !search.years.includes(question.year)) return false;
    if (
      search.difficulties.length > 0 &&
      (!question.difficulty || !search.difficulties.includes(question.difficulty))
    ) return false;
    if (search.institutions.length > 0 && !search.institutions.includes(question.institution)) return false;
    if (search.concursos.length > 0 && !search.concursos.includes(question.concurso)) return false;
    if (search.levels.length > 0 && !search.levels.includes(question.level)) return false;

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
        question.level,
        question.difficulty ?? '',
        question.year,
      ]
        .join(' ');
      const normalizedHaystack = normalizeSearchText(haystack);
      if (!normalizedHaystack.includes(keyword)) return false;
    }

    return true;
  });
}
