import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import { QUESTIONS } from '../data/questions.ts';
import { buildQuickChallenge, QUICK_CHALLENGE_SIZE } from '../lib/quick-challenge.ts';
import type { AnswerRecord } from '../types/index.ts';

test('o desafio rápido aceita conteúdo vazio enquanto as questões remotas carregam', () => {
  assert.deepEqual(buildQuickChallenge(undefined, undefined, {}, [], []), []);
});

test('o desafio rápido limita a sessão e prioriza questões ainda não respondidas', () => {
  const answeredQuestion = QUESTIONS[0];
  const answers: Record<string, AnswerRecord> = {
    [answeredQuestion.id]: {
      questionId: answeredQuestion.id,
      subject: answeredQuestion.subject,
      selected: answeredQuestion.correct,
      isCorrect: true,
      answeredAt: '2026-09-06T08:00:00.000Z',
    },
  };

  const challenge = buildQuickChallenge(undefined, undefined, answers, QUESTIONS, []);

  assert.equal(challenge.length, QUICK_CHALLENGE_SIZE);
  assert.ok(!challenge.some((question) => question.id === answeredQuestion.id));
});

test('a tela protege o acesso à questão até o carregamento remoto terminar', () => {
  const screen = readFileSync(
    new NodeURL('../app/questoes/desafio.tsx', import.meta.url),
    'utf8',
  );

  assert.match(screen, /if \(!questions \|\| questions\.length === 0\)/);
  assert.match(screen, /accessibilityLabel="Carregando desafio rápido"/);
  assert.match(screen, /Não foi possível carregar as questões/);
  assert.match(screen, /Tentar novamente/);
});
