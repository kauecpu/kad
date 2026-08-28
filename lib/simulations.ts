import { CONCURSO_PACKS } from '../data/exam-concursos.ts';
import { QUESTIONS } from '../data/questions.ts';
import type {
  AlternativeId,
  ConcursoPack,
  Question,
  SimulationConfig,
  SimulationQuestion,
  SimulationSession,
} from '../types/index.ts';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function includesAny(value: string, terms: string[] = []): boolean {
  const normalized = normalize(value);
  return terms.some((term) => normalized.includes(normalize(term)));
}

/** Confirma que a questão pertence ao concurso ou à área representada pelo pacote. */
export function questionMatchesPack(question: Question, pack: ConcursoPack): boolean {
  const { institutions = [], concursos = [], roles = [] } = pack.questionScope;
  const hasScope = institutions.length + concursos.length + roles.length > 0;
  if (!hasScope) return false;

  const inScope =
    includesAny(question.institution, institutions) ||
    includesAny(question.concurso, concursos) ||
    includesAny(question.role, roles);

  return inScope && pack.disciplines.includes(question.discipline);
}

/** Questões realmente relacionadas ao concurso ou à área, sem misturar apenas por disciplina. */
export function questionsForPack(
  pack: ConcursoPack,
  questions: Question[] = QUESTIONS,
): Question[] {
  return questions.filter((question) => questionMatchesPack(question, pack));
}

export function recommendPackForGoal(
  packs: ConcursoPack[],
  targetRole?: string
): ConcursoPack | undefined {
  const goal = normalize(targetRole ?? '');
  if (!goal) return undefined;

  return packs
    .map((pack) => {
      const searchable = [pack.name, pack.subtitle ?? '', ...pack.goalKeywords].map(normalize);
      const score = searchable.reduce((total, value) => {
        if (value === goal) return total + 4;
        if (value.includes(goal) || goal.includes(value)) return total + 2;
        const goalTerms = goal.split(/\s+/).filter((term) => term.length > 3);
        return total + goalTerms.filter((term) => value.includes(term)).length;
      }, 0);
      return { pack, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.pack;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  disciplines: [],
  topics: [],
  boards: [],
  years: [],
  difficulties: [],
  questionCount: 10,
  durationMinutes: 20,
  shuffleQuestions: true,
  shuffleAlternatives: true,
};

export function simulationCandidates(
  config: SimulationConfig,
  questions: Question[] = QUESTIONS,
): Question[] {
  const pack = config.packId
    ? CONCURSO_PACKS.find((item) => item.id === config.packId)
    : undefined;

  return questions.filter((question) => {
    if (pack && !questionMatchesPack(question, pack)) return false;
    if (
      config.disciplines.length > 0 &&
      !config.disciplines.includes(question.discipline)
    ) {
      return false;
    }
    if (config.topics.length > 0 && !config.topics.includes(question.topic)) return false;
    if (config.boards.length > 0 && !config.boards.includes(question.board)) return false;
    if (config.years.length > 0 && !config.years.includes(question.year)) return false;
    if (
      config.difficulties.length > 0 &&
      (!question.difficulty || !config.difficulties.includes(question.difficulty))
    ) {
      return false;
    }
    return true;
  });
}

function shuffled<T>(values: T[]): T[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

export function createSimulationSession(
  config: SimulationConfig,
  availableQuestions: Question[] = QUESTIONS,
): SimulationSession | null {
  const candidates = simulationCandidates(config, availableQuestions);
  if (candidates.length === 0) return null;

  const orderedQuestions = config.shuffleQuestions ? shuffled(candidates) : candidates;
  const selectedQuestions = orderedQuestions.slice(
    0,
    Math.min(config.questionCount, orderedQuestions.length)
  );

  const questions: SimulationQuestion[] = selectedQuestions.map((question) => {
    const alternatives = question.alternatives.map((alternative) => alternative.id);
    return {
      questionId: question.id,
      alternativeOrder: config.shuffleAlternatives
        ? shuffled(alternatives)
        : alternatives,
    };
  });

  const createdAt = new Date().toISOString();
  return {
    id: `simulado-${Date.now()}`,
    status: 'active',
    config: {
      ...config,
      questionCount: questions.length,
    },
    questions,
    answers: {},
    currentIndex: 0,
    remainingSeconds: config.durationMinutes * 60,
    createdAt,
    updatedAt: createdAt,
  };
}

export function simulationQuestionById(
  questionId: string,
  questions: Question[] = QUESTIONS,
): Question | undefined {
  return questions.find((question) => question.id === questionId);
}

export function simulationScore(session: SimulationSession, questions: Question[] = QUESTIONS) {
  const items = session.questions
    .map((item) => {
      const question = simulationQuestionById(item.questionId, questions);
      const selected = session.answers[item.questionId];
      return question
        ? {
            question,
            selected,
            correct: selected === question.correct,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const answered = items.filter((item) => item.selected).length;
  const correct = items.filter((item) => item.correct).length;
  const wrong = answered - correct;
  const blank = items.length - answered;
  const accuracy = items.length > 0 ? (correct / items.length) * 100 : 0;

  const subjectMap = new Map<string, { total: number; correct: number }>();
  for (const item of items) {
    const current = subjectMap.get(item.question.subject) ?? { total: 0, correct: 0 };
    subjectMap.set(item.question.subject, {
      total: current.total + 1,
      correct: current.correct + (item.correct ? 1 : 0),
    });
  }

  const bySubject = Array.from(subjectMap.entries())
    .map(([subject, values]) => ({
      subject,
      total: values.total,
      correct: values.correct,
      accuracy: values.total > 0 ? (values.correct / values.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject, 'pt-BR'));

  return { items, total: items.length, answered, correct, wrong, blank, accuracy, bySubject };
}

export function canonicalAlternativeOrder(): AlternativeId[] {
  return ['A', 'B', 'C', 'D', 'E'];
}
