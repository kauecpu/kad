import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLevelActivity, emptyLevelLedger, levelColor, levelProgress, type LevelActivity } from '../contracts/levels.ts';

const at = '2026-09-02T15:00:00.000Z';
const question = (id: string, itemId = id, isCorrect = true): Extract<LevelActivity, { kind: 'question' }> => ({ id, kind: 'question', itemId, selected: 'A', isCorrect, reviewed: false, occurredAt: at });

test('thresholds advance exactly, never exceed 100, and keep excess XP', () => {
  assert.equal(levelProgress(149).level, 0);
  assert.deepEqual(levelProgress(150), { totalXp: 150, level: 1, currentXp: 0, nextCost: 180, remainingXp: 180, ratio: 0, max: false });
  assert.equal(levelProgress(329).level, 1);
  assert.equal(levelProgress(330).level, 2);
  assert.equal(levelProgress(26270).level, 37);
  assert.equal(levelProgress(26270).remainingXp, 520);
  assert.equal(levelProgress(163499).level, 99);
  assert.deepEqual(levelProgress(163525), { totalXp: 163525, level: 100, currentXp: 25, nextCost: 0, remainingXp: 0, ratio: 1, max: true });
  assert.throws(() => levelProgress(Number.NaN));
});

test('perceptual level color stays white at 0 and brand purple at 100', () => {
  assert.equal(levelColor(0), '#FFFFFF');
  assert.equal(levelColor(50), '#AF9EF2');
  assert.equal(levelColor(100), '#6D28D9');
  assert.equal(new Set(Array.from({ length: 101 }, (_, n) => levelColor(n))).size, 101);
});

test('same event and first question replay cannot farm XP after reset or next day', () => {
  let ledger = applyLevelActivity(emptyLevelLedger(), question('event1', 'q1'), at);
  assert.equal(ledger.totalXp, 10);
  ledger = applyLevelActivity(ledger, question('event1', 'q1'), at);
  ledger = applyLevelActivity(ledger, question('event2', 'q1'), '2026-09-03T15:00:00Z');
  assert.equal(ledger.totalXp, 10);
});

test('20 distinct answers hit daily cap, constancy is granted only once', () => {
  let ledger = emptyLevelLedger();
  for (let i = 0; i < 25; i++) ledger = applyLevelActivity(ledger, question(`event${i}`), at);
  assert.equal(ledger.totalXp, 220);
  assert.equal(ledger.entries.filter(e => e.kind === 'consistency').length, 1);
  assert.equal(ledger.entries.at(-1)?.reason, 'daily_limit');
});

test('wrong answer review needs comment acknowledgement and respects rolling seven days', () => {
  let ledger = applyLevelActivity(emptyLevelLedger(), question('one', 'q1', false), at);
  ledger = applyLevelActivity(ledger, question('two', 'q1', false), at);
  assert.equal(ledger.totalXp, 10);
  ledger = applyLevelActivity(ledger, { ...question('three', 'q1', false), reviewed: true }, at);
  assert.equal(ledger.totalXp, 30);
  ledger = applyLevelActivity(ledger, { ...question('four', 'q1', false), reviewed: true }, '2026-09-08T15:00:00Z');
  assert.equal(ledger.totalXp, 30);
  ledger = applyLevelActivity(ledger, { ...question('five', 'q1', true), reviewed: true }, '2026-09-09T15:00:00Z');
  assert.equal(ledger.totalXp, 50);
});

test('flashcards need reveal then rating and are capped per item and day', () => {
  let ledger = emptyLevelLedger();
  const card = (id: string, itemId: string): LevelActivity => ({ id, kind: 'flashcard', itemId, rating: 'good', occurredAt: at });
  ledger = applyLevelActivity(ledger, card('r1', 'c1'), at);
  ledger = applyLevelActivity(ledger, card('r2', 'c1'), at);
  assert.equal(ledger.totalXp, 5);
  for (let i = 2; i <= 12; i++) ledger = applyLevelActivity(ledger, card(`r${i + 1}`, `c${i}`), at);
  assert.equal(ledger.totalXp, 70);
});

test('simulations award answers once and only one daily bonus for ten distinct items', () => {
  const answers = Array.from({ length: 10 }, (_, i) => ({ itemId: `q${i}`, selected: 'A', isCorrect: true }));
  let ledger = applyLevelActivity(emptyLevelLedger(), { id: 's1', kind: 'simulation', itemId: 's1', answers, occurredAt: at }, at);
  assert.equal(ledger.totalXp, 140);
  ledger = applyLevelActivity(ledger, { id: 's2', kind: 'simulation', itemId: 's2', answers, occurredAt: at }, at);
  assert.equal(ledger.totalXp, 140);
  const duplicated = Array.from({ length: 10 }, () => answers[0]);
  assert.equal(applyLevelActivity(emptyLevelLedger(), { id: 's3', kind: 'simulation', itemId: 's3', answers: duplicated, occurredAt: at }, at).totalXp, 10);
});
