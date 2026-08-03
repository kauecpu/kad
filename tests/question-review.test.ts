import assert from 'node:assert/strict';
import test from 'node:test';

import { QUESTIONS } from '../data/questions.ts';
import { questionsForReview } from '../lib/question-review.ts';
import type { AnswerRecord } from '../types/index.ts';

const first = QUESTIONS[0];
const second = QUESTIONS[1];
const third = QUESTIONS[2];

const answers: Record<string, AnswerRecord> = {
  [first.id]: {
    questionId: first.id,
    subject: first.subject,
    selected: first.correct,
    isCorrect: true,
    answeredAt: '2026-08-01T10:00:00.000Z',
  },
  [second.id]: {
    questionId: second.id,
    subject: second.subject,
    selected: second.alternatives.find((alternative) => alternative.id !== second.correct)!.id,
    isCorrect: false,
    answeredAt: '2026-08-01T11:00:00.000Z',
  },
};

test('favoritas aparecem da mais recente para a mais antiga', () => {
  const result = questionsForReview(QUESTIONS, answers, [first.id, third.id], 'favorites');
  assert.deepEqual(result.map((question) => question.id), [third.id, first.id]);
});

test('acertadas e erradas acompanham o resultado salvo', () => {
  assert.deepEqual(
    questionsForReview(QUESTIONS, answers, [], 'correct').map((question) => question.id),
    [first.id]
  );
  assert.deepEqual(
    questionsForReview(QUESTIONS, answers, [], 'wrong').map((question) => question.id),
    [second.id]
  );
});
