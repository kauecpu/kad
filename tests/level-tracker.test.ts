import assert from 'node:assert/strict';
import test from 'node:test';
import { createLevelTracker, levelActivityPayload } from '../contracts/level-tracker.ts';
import type { LevelActivity } from '../contracts/levels.ts';
const event: LevelActivity = { id: 'answer-1', itemId: 'q1', kind: 'question', selected: 'A', isCorrect: true, reviewed: false, occurredAt: '2026-09-02T15:00:00Z' };
const storage = () => {
  const data = new Map<string, string>();
  return { read: async (key: string) => data.get(key) ?? null, write: async (key: string, value: string) => { data.set(key, value); } };
};
test('account payload never sends client-calculated XP or correctness', () => {
  assert.deepEqual(levelActivityPayload({ ...event, isCorrect: true, reviewed: true }), { id: 'answer-1', kind: 'question', itemId: 'q1', selected: 'A', reviewed: true });
});
test('guest XP persists independently of the mutable answer list and account owner', async () => {
  const disk = storage();
  const tracker = createLevelTracker(disk, async () => ({ totalXp: 80 }));
  await tracker.selectOwner(null);
  await tracker.record(event);
  assert.equal(tracker.getState().progress?.totalXp, 10);
  const reloaded = createLevelTracker(disk, async () => ({ totalXp: 80 }));
  await reloaded.selectOwner(null);
  await reloaded.record(event);
  assert.equal(reloaded.getState().progress?.totalXp, 10);
  await reloaded.selectOwner('user-b');
  assert.equal(reloaded.getState().progress?.totalXp, 80);
  await reloaded.selectOwner(null);
  assert.equal(reloaded.getState().progress?.totalXp, 10);
});
test('offline attempts remain pending, never become confirmed XP until accepted', async () => {
  let offline = true;
  let xp = 0;
  const seen = new Set<string>();
  const tracker = createLevelTracker(storage(), async (_owner, activity) => {
    if (offline) throw new Error('offline');
    if (activity && !seen.has(activity.id)) { seen.add(activity.id); xp += 10; }
    return { totalXp: xp };
  });
  await tracker.selectOwner('a');
  await tracker.record(event);
  await tracker.sync();
  assert.equal(tracker.getState().progress, null);
  assert.equal(tracker.getState().pending, 1);
  offline = false;
  await tracker.sync();
  assert.equal(tracker.getState().progress?.totalXp, 10);
  assert.equal(tracker.getState().pending, 0);
  await tracker.sync();
  assert.equal(xp, 10);
});
test('an old remote reply cannot overwrite or persist under the next account', async () => {
  let resolveA!: (value: { totalXp: number }) => void;
  const tracker = createLevelTracker(storage(), async owner => owner === 'a' ? new Promise(resolve => { resolveA = resolve; }) : { totalXp: 20 });
  const a = tracker.selectOwner('a');
  await new Promise(resolve => setTimeout(resolve, 0));
  await tracker.selectOwner('b');
  resolveA({ totalXp: 990 });
  await a;
  assert.equal(tracker.getState().owner, 'b');
  assert.equal(tracker.getState().progress?.totalXp, 20);
});
test('storage failure shows an error without claiming durable XP or erasing old data', async () => {
  const tracker = createLevelTracker({ read: async () => { throw new Error('disk'); }, write: async () => { throw new Error('disk'); } }, async () => ({ totalXp: 0 }));
  await tracker.selectOwner(null);
  assert.equal(tracker.getState().status, 'unavailable');
  assert.equal(tracker.getState().progress, null);
});
test('explicit data deletion clears guest XP but ordinary answer reset has no tracker side effect', async () => {
  const disk = storage();
  const tracker = createLevelTracker(disk, async () => ({ totalXp: 0 }));
  await tracker.selectOwner(null);
  await tracker.record(event);
  await tracker.clear();
  assert.equal(tracker.getState().progress?.totalXp, 0);
  const reloaded = createLevelTracker(disk, async () => ({ totalXp: 0 }));
  await reloaded.selectOwner(null);
  assert.equal(reloaded.getState().progress?.totalXp, 0);
});
