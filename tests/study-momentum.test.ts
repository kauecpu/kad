import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import { QUESTIONS } from '../data/questions.ts';
import {
  buildStudyMomentum,
  DEFAULT_WEEKLY_QUESTION_GOAL,
  formatRecentStudyTime,
  mergeQuestionActivityCounts,
  normalizeWeeklyQuestionGoal,
  recordQuestionStudyActivity,
} from '../lib/study-momentum.ts';
import type { AnswerRecord, SimulationSession } from '../types/index.ts';

const at = (day: number, hour = 12) => new Date(2026, 7, day, hour).toISOString();
const now = new Date(2026, 7, 16, 18);

function answer(index: number, day: number, correct = true): AnswerRecord {
  const question = QUESTIONS[index];
  return {
    questionId: question.id,
    subject: question.subject,
    selected: correct ? question.correct : question.alternatives.find((item) => item.id !== question.correct)!.id,
    isCorrect: correct,
    answeredAt: at(day),
  };
}

function completedSimulation(day: number, answered = 2): SimulationSession {
  const questions = QUESTIONS.slice(3, 6).map((question) => ({
    questionId: question.id,
    alternativeOrder: question.alternatives.map((alternative) => alternative.id),
  }));
  return {
    id: `simulado-${day}`,
    status: 'completed',
    config: {
      disciplines: [],
      topics: [],
      boards: [],
      years: [],
      difficulties: [],
      questionCount: questions.length,
      durationMinutes: 20,
      shuffleQuestions: false,
      shuffleAlternatives: false,
    },
    questions,
    answers: Object.fromEntries(
      questions.slice(0, answered).map((item) => [item.questionId, 'A'])
    ),
    currentIndex: 0,
    remainingSeconds: 0,
    createdAt: at(day, 10),
    completedAt: at(day, 13),
  };
}

test('soma questões e simulados reais na meta da semana atual', () => {
  const answers = {
    [QUESTIONS[0].id]: answer(0, 14),
    [QUESTIONS[1].id]: answer(1, 15),
    [QUESTIONS[2].id]: answer(2, 16),
  };
  const momentum = buildStudyMomentum({
    answers,
    simulationHistory: [completedSimulation(14, 2)],
    questions: QUESTIONS,
    weeklyGoal: 10,
    now,
  });

  assert.equal(momentum.weeklyQuestions, 5);
  assert.equal(momentum.weeklyProgress, 50);
  assert.equal(momentum.streakDays, 3);
  assert.deepEqual(
    momentum.weekDays.filter((day) => day.active).map((day) => day.dayNumber),
    [14, 15, 16]
  );
});

test('não carrega atividade da semana anterior para a meta atual', () => {
  const momentum = buildStudyMomentum({
    answers: {
      [QUESTIONS[0].id]: answer(0, 9),
      [QUESTIONS[1].id]: answer(1, 10),
    },
    simulationHistory: [],
    questions: QUESTIONS,
    weeklyGoal: 10,
    now,
  });

  assert.equal(momentum.weeklyQuestions, 1);
  assert.equal(momentum.weeklyProgress, 10);
});

test('mantém a sequência de ontem, mas interrompe quando existe uma lacuna', () => {
  const yesterday = buildStudyMomentum({
    answers: {
      [QUESTIONS[0].id]: answer(0, 14),
      [QUESTIONS[1].id]: answer(1, 15),
    },
    simulationHistory: [],
    questions: QUESTIONS,
    now,
  });
  const gap = buildStudyMomentum({
    answers: {
      [QUESTIONS[0].id]: answer(0, 14),
      [QUESTIONS[1].id]: answer(1, 16),
    },
    simulationHistory: [],
    questions: QUESTIONS,
    now,
  });

  assert.equal(yesterday.streakDays, 2);
  assert.equal(gap.streakDays, 1);
});

test('mantém a atividade diária mesmo depois que a resposta atual é removida', () => {
  const firstDay = recordQuestionStudyActivity({}, new Date(2026, 7, 15, 9));
  const withToday = recordQuestionStudyActivity(firstDay, new Date(2026, 7, 16, 10));
  const repeatedToday = recordQuestionStudyActivity(withToday, new Date(2026, 7, 16, 11));
  const momentum = buildStudyMomentum({
    answers: {},
    questionActivityByDate: repeatedToday,
    simulationHistory: [],
    questions: QUESTIONS,
    weeklyGoal: 10,
    now,
  });

  assert.equal(momentum.weeklyQuestions, 3);
  assert.equal(momentum.streakDays, 2);
  assert.deepEqual(momentum.recentActivities, []);
});

test('migração preserva o maior total conhecido de cada dia', () => {
  const merged = mergeQuestionActivityCounts(
    { '2026-08-16': 4 },
    {
      [QUESTIONS[0].id]: answer(0, 15),
      [QUESTIONS[1].id]: answer(1, 16),
    }
  );

  assert.deepEqual(merged, { '2026-08-16': 4, '2026-08-15': 1 });
});

test('ordena respostas e simulados no histórico recente', () => {
  const momentum = buildStudyMomentum({
    answers: {
      [QUESTIONS[0].id]: answer(0, 16, false),
      [QUESTIONS[1].id]: answer(1, 15),
    },
    simulationHistory: [completedSimulation(15, 2)],
    questions: QUESTIONS,
    now,
  });

  assert.deepEqual(momentum.recentActivities.map((item) => item.kind), [
    'question',
    'simulation',
    'question',
  ]);
  assert.match(momentum.recentActivities[0].description, /Revisar resposta/);
  assert.match(momentum.recentActivities[0].route, /^\/questoes\//);
  assert.equal(formatRecentStudyTime(momentum.recentActivities[0].occurredAt, now).startsWith('Hoje'), true);
});

test('limita o histórico recente quando a tela pede um painel mais compacto', () => {
  const momentum = buildStudyMomentum({
    answers: {
      [QUESTIONS[0].id]: answer(0, 16, false),
      [QUESTIONS[1].id]: answer(1, 15),
    },
    simulationHistory: [completedSimulation(15, 2)],
    questions: QUESTIONS,
    recentLimit: 2,
    now,
  });

  assert.equal(momentum.recentActivities.length, 2);
});

test('estado vazio não inventa progresso e usa a meta padrão', () => {
  const momentum = buildStudyMomentum({
    answers: {},
    simulationHistory: [],
    questions: QUESTIONS,
    now,
  });

  assert.equal(momentum.weeklyGoal, DEFAULT_WEEKLY_QUESTION_GOAL);
  assert.equal(momentum.weeklyQuestions, 0);
  assert.equal(momentum.weeklyProgress, 0);
  assert.equal(momentum.streakDays, 0);
  assert.deepEqual(momentum.recentActivities, []);
  assert.equal(momentum.weekDays.length, 7);
});

test('normaliza metas semanais antes de persistir', () => {
  assert.equal(normalizeWeeklyQuestionGoal(undefined), 25);
  assert.equal(normalizeWeeklyQuestionGoal(2), 5);
  assert.equal(normalizeWeeklyQuestionGoal(500), 200);
  assert.equal(normalizeWeeklyQuestionGoal(24.6), 25);
});

const source = (path: string) => readFileSync(new NodeURL(path, import.meta.url), 'utf8');
const home = source('../app/(tabs)/inicio.tsx');
const card = source('../components/home-study-momentum.tsx');
const provider = source('../providers/app-provider.tsx');

test('tela inicial apresenta ritmo e histórico com controles acessíveis', () => {
  assert.match(home, /title="Seu ritmo"/);
  assert.match(home, /title="Atividade recente"/);
  assert.match(card, /accessibilityLabel="Ajustar meta semanal"/);
  assert.match(card, /accessibilityRole="radiogroup"/);
  assert.match(card, /Seu histórico começa aqui/);
  assert.match(card, /Faça o desafio diário para registrar sua primeira atividade/);
  assert.match(card, /accessibilityLabel="Fazer desafio diário"/);
  assert.doesNotMatch(card, /numberOfLines=\{1\}/);
  assert.match(card, /minHeight: 44/);
  assert.match(card, /stackEmpty/);
  assert.match(home, /recentLimit: 2/);
  assert.match(provider, /weeklyQuestionGoal: normalizeWeeklyQuestionGoal/);
});
