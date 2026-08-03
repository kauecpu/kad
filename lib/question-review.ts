import type { AnswerRecord, Question } from '../types/index.ts';

export type QuestionReviewType = 'favorites' | 'correct' | 'wrong';

export function questionsForReview(
  questions: Question[],
  answers: Record<string, AnswerRecord>,
  favoriteQuestionIds: string[],
  type: QuestionReviewType
): Question[] {
  const questionsById = new Map(questions.map((question) => [question.id, question]));

  if (type === 'favorites') {
    return [...favoriteQuestionIds]
      .reverse()
      .map((questionId) => questionsById.get(questionId))
      .filter((question): question is Question => question !== undefined);
  }

  const shouldBeCorrect = type === 'correct';
  return Object.values(answers)
    .filter((answer) => answer.isCorrect === shouldBeCorrect)
    .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
    .map((answer) => questionsById.get(answer.questionId))
    .filter((question): question is Question => question !== undefined);
}
