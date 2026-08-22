import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import { CONCURSO_PACKS } from '../data/exam-concursos.ts';
import { QUESTIONS } from '../data/questions.ts';
import { RANKING_PARTICIPANTS } from '../data/ranking.ts';
import {
  answerBelongsToPeriod,
  buildRanking,
  localRankingScore,
  RANKING_POINTS,
} from '../lib/ranking.ts';
import { questionsForPack } from '../lib/simulations.ts';
import type { AnswerRecord, Question } from '../types/index.ts';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const tabsLayout = source('../app/(tabs)/_layout.tsx');
const rankTab = source('../app/(tabs)/rank.tsx');

function correctAnswer(question: Question, answeredAt: string): AnswerRecord {
  return {
    questionId: question.id,
    subject: question.subject,
    selected: question.correct,
    isCorrect: true,
    answeredAt,
  };
}

test('pontuação local respeita os pesos fácil, média e difícil', () => {
  assert.deepEqual(RANKING_POINTS, { Fácil: 1, Média: 2, Difícil: 3 });

  const easy = QUESTIONS.find((question) => question.difficulty === 'Fácil')!;
  const medium = QUESTIONS.find((question) => question.difficulty === 'Média')!;
  const hard = QUESTIONS.find((question) => question.difficulty === 'Difícil')!;
  const answers = {
    [easy.id]: correctAnswer(easy, '2026-08-16T12:00:00.000Z'),
    [medium.id]: correctAnswer(medium, '2026-08-16T12:01:00.000Z'),
    [hard.id]: correctAnswer(hard, '2026-08-16T12:02:00.000Z'),
  };

  const score = localRankingScore({
    answers,
    questions: QUESTIONS,
    packs: CONCURSO_PACKS,
    period: 'today',
    packId: 'all',
    now: new Date(2026, 7, 16, 18),
  });

  assert.equal(score.points, 6);
  assert.equal(score.correct, 3);
  assert.equal(score.accuracy, 100);
});

test('períodos usam o dia e o mês locais sem afetar o ranking geral', () => {
  const now = new Date(2026, 7, 16, 18);
  assert.equal(answerBelongsToPeriod('2026-08-16', 'today', now), true);
  assert.equal(answerBelongsToPeriod('2026-08-15', 'today', now), false);
  assert.equal(answerBelongsToPeriod('2026-08-01', 'month', now), true);
  assert.equal(answerBelongsToPeriod('2026-07-31', 'month', now), false);
  assert.equal(answerBelongsToPeriod('2025-01-01', 'all', now), true);
});

test('filtro por concurso considera somente questões pertencentes ao pacote', () => {
  const pack = CONCURSO_PACKS.find((item) => item.id === 'banco-do-brasil')!;
  const included = questionsForPack(pack)[0];
  const excluded = QUESTIONS.find((question) => !questionsForPack(pack).some((item) => item.id === question.id))!;
  const answers = {
    [included.id]: correctAnswer(included, '2026-08-16'),
    [excluded.id]: correctAnswer(excluded, '2026-08-16'),
  };

  const score = localRankingScore({
    answers,
    questions: QUESTIONS,
    packs: CONCURSO_PACKS,
    period: 'all',
    packId: pack.id,
  });

  assert.equal(score.correct, 1);
  assert.equal(score.points, RANKING_POINTS[included.difficulty]);
});

test('classificação ordena por pontos e mantém a posição do usuário atual', () => {
  const ranking = buildRanking({
    participants: RANKING_PARTICIPANTS.slice(0, 2),
    period: 'today',
    packId: 'all',
    currentUser: {
      id: 'current-user',
      name: 'Você',
      username: '@voce',
      initials: 'VC',
      points: 99,
      correct: 40,
      accuracy: 90,
      streak: 0,
    },
  });

  assert.equal(ranking[0].isCurrentUser, true);
  assert.equal(ranking[0].rank, 1);
  assert.ok(ranking.every((entry, index) => entry.rank === index + 1));
});

test('o Rank ocupa o centro da barra inferior e abre a tela de ranking', () => {
  const visibleTabs = Array.from(
    tabsLayout.matchAll(/name="(inicio|questoes|rank|simulados|perfil)"/g),
    (match) => match[1]
  );

  assert.deepEqual(visibleTabs, ['inicio', 'questoes', 'rank', 'simulados', 'perfil']);
  assert.match(tabsLayout, /const RankTabIcon = tabIcon\('trophy-outline', 'trophy'\)/);
  assert.match(tabsLayout, /name="rank"[\s\S]*?title: 'Rank'[\s\S]*?tabBarIcon: RankTabIcon/);
  assert.match(tabsLayout, /name="concursos" options=\{\{ href: null \}\}/);
  assert.match(rankTab, /export \{ default \} from '\.\.\/ranking';/);
});
