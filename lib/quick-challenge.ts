import { findStudyPackForConcurso } from './concursos.ts';
import { questionsForPack, recommendPackForGoal } from './simulations.ts';
import { normalizeSearchText } from './text.ts';
import type { AnswerRecord, Concurso, ConcursoPack, Question } from '../types/index.ts';

export const QUICK_CHALLENGE_SIZE = 3;

export function buildQuickChallenge(
  targetRole: string | undefined,
  focusedConcurso: Concurso | undefined,
  answers: Record<string, AnswerRecord>,
  questions: Question[],
  packs: ConcursoPack[],
): Question[] {
  const goal = normalizeSearchText(targetRole ?? '');
  const exactMatches = goal
    ? questions.filter((question) => normalizeSearchText(question.role) === goal)
    : [];
  const concursoPack = focusedConcurso
    ? findStudyPackForConcurso(focusedConcurso, packs)
    : undefined;
  const goalPack = !focusedConcurso ? recommendPackForGoal(packs, targetRole) : undefined;
  const packQuestions = concursoPack
    ? questionsForPack(concursoPack, questions)
    : goalPack
      ? questionsForPack(goalPack, questions)
      : [];
  const pool = focusedConcurso
    ? packQuestions
    : exactMatches.length >= QUICK_CHALLENGE_SIZE
      ? exactMatches
      : packQuestions.length >= QUICK_CHALLENGE_SIZE
        ? packQuestions
        : questions;

  return [...pool]
    .sort((a, b) => Number(Boolean(answers[a.id])) - Number(Boolean(answers[b.id])))
    .slice(0, QUICK_CHALLENGE_SIZE);
}
