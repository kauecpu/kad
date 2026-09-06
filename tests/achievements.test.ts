import assert from 'node:assert/strict';
import test from 'node:test';

import { ACHIEVEMENT_CATALOG, achievementsFromLedger, metricsFromLedger, nextLockedAchievement } from '../contracts/achievements.ts';
import { applyLevelActivity, emptyLevelLedger, type LevelActivity } from '../contracts/levels.ts';

const at = '2026-09-06T15:00:00Z';
const question = (id: string, itemId: string, isCorrect = true, occurredAt = at): LevelActivity => ({ id, itemId, kind: 'question', selected: isCorrect ? 'B' : 'A', isCorrect, reviewed: false, occurredAt });

test('catálogo contém a conquista de mil questões com o critério explícito', () => {
  const milestone = ACHIEVEMENT_CATALOG.find(item => item.key === 'mil_questoes');
  assert.equal(milestone?.threshold, 1000);
  assert.equal(milestone?.description, 'Responda 1.000 questões diferentes.');
  assert.equal(new Set(ACHIEVEMENT_CATALOG.map(item => item.key)).size, ACHIEVEMENT_CATALOG.length);
});

test('questão repetida não aumenta o progresso de conquistas', () => {
  let ledger = applyLevelActivity(emptyLevelLedger(), question('one', 'q1'), at);
  ledger = applyLevelActivity(ledger, question('two', 'q1'), '2026-09-07T15:00:00Z');
  const metrics = metricsFromLedger(ledger);
  assert.equal(metrics.distinctQuestions, 1);
  assert.equal(metrics.distinctCorrect, 1);
});

test('acertos de visitante seguem a primeira resposta válida da questão', () => {
  let ledger = applyLevelActivity(emptyLevelLedger(), question('wrong', 'q1', false), at);
  ledger = applyLevelActivity(ledger, question('right-later', 'q1', true), '2026-09-07T15:00:00Z');
  const metrics = metricsFromLedger(ledger);
  assert.equal(metrics.distinctQuestions, 1);
  assert.equal(metrics.distinctCorrect, 0);
});

test('limites desbloqueiam uma conquista uma única vez na projeção local', () => {
  let ledger = emptyLevelLedger();
  for (let index = 1; index <= 10; index++) ledger = applyLevelActivity(ledger, question(`e${index}`, `q${index}`), at);
  const achievements = achievementsFromLedger(ledger);
  assert.equal(achievements.filter(item => item.key === 'aquecimento' && item.unlockedAt).length, 1);
  assert.equal(achievements.find(item => item.key === 'ritmo_firme')?.value, 10);
});

test('sequência usa dias de atividade premiada e detecta lacunas', () => {
  let ledger = emptyLevelLedger();
  ledger = applyLevelActivity(ledger, question('one', 'q1', true, '2026-09-01T15:00:00Z'), '2026-09-01T15:00:00Z');
  ledger = applyLevelActivity(ledger, question('two', 'q2', true, '2026-09-02T15:00:00Z'), '2026-09-02T15:00:00Z');
  ledger = applyLevelActivity(ledger, question('three', 'q3', true, '2026-09-04T15:00:00Z'), '2026-09-04T15:00:00Z');
  assert.equal(metricsFromLedger(ledger).longestStreak, 2);
});

test('próxima conquista privilegia o progresso mais próximo', () => {
  let ledger = emptyLevelLedger();
  for (let index = 1; index <= 9; index++) ledger = applyLevelActivity(ledger, question(`e${index}`, `q${index}`), at);
  assert.equal(nextLockedAchievement(achievementsFromLedger(ledger))?.key, 'aquecimento');
});
