import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudySync, type StudyAnswer } from '../contracts/study-sync.ts';
import { ownedStudyRequest } from '../contracts/study-request.ts';
const answer: StudyAnswer = { questionId: 'q1', subject: 'Test', selected: 'B', isCorrect: true, answeredAt: '2026-09-03T12:00:00Z' };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture() {
  const disk = new Map<string, string>();
  const server = new Map<string, Record<string, StudyAnswer>>();
  let offline = false;
  let failWrite = false;
  let requests = 0;
  const deps = {
    read: async (owner: string) => disk.get(owner) ?? null,
    write: async (owner: string, value: string) => { if (failWrite) throw Error(); disk.set(owner, value); },
    load: async (owner: string) => { if (offline) throw Error(); return structuredClone(server.get(owner) ?? {}); },
    send: async (owner: string, m: { questionId: string; answer: StudyAnswer | null }) => {
      if (offline) throw Error(); requests++;
      const rows = server.get(owner) ?? {};
      if (m.answer) rows[m.questionId] = m.answer; else delete rows[m.questionId];
      server.set(owner, rows);
    },
  };
  return { disk, server, deps, offline: (value: boolean) => { offline = value; }, failWrite: (value: boolean) => { failWrite = value; }, requests: () => requests };
}
test('offline answer survives restart, reconnect, result read and logout/login without duplication', async () => {
  const f = fixture(); f.offline(true);
  const first = createStudySync(f.deps);
  await first.selectOwner('a'); await first.sync();
  assert.equal(first.answer(answer), true);
  assert.equal(first.answer(answer), false);
  await first.flush(); await first.sync();
  assert.equal(first.getState().status, 'unavailable'); first.dispose();
  const reopened = createStudySync(f.deps);
  await reopened.selectOwner('a'); await reopened.sync();
  assert.equal(reopened.getState().answers.q1.selected, 'B');
  f.offline(false); await reopened.sync(); await reopened.sync();
  assert.equal(f.requests(), 1);
  assert.equal(reopened.getState().status, 'saved');
  await reopened.selectOwner(null); assert.deepEqual(reopened.getState().answers, {});
  await reopened.selectOwner('a'); await reopened.sync();
  assert.equal(Object.values(reopened.getState().answers).filter(a => a.isCorrect).length, 1);
});
test('a delayed read cannot erase an answer or resurrect a reset', async () => {
  const f = fixture(); let resolve!: (value: Record<string, StudyAnswer>) => void;
  const s = createStudySync({ ...f.deps, load: () => new Promise(r => { resolve = r; }) });
  await s.selectOwner('a'); await tick();
  s.answer(answer); await s.flush(); resolve({}); await tick();
  assert.equal(s.getState().answers.q1.selected, 'B');
  s.reset('q1'); await s.flush(); resolve({ q1: answer }); await tick();
  assert.deepEqual(s.getState().answers, {});
  resolve({}); await s.sync();
  assert.equal(s.getState().pending, 0);
});
test('old account read and mutation completion cannot populate the next account', async () => {
  const f = fixture(); let resolve!: () => void;
  const s = createStudySync({ ...f.deps, send: async () => new Promise<void>(r => { resolve = r; }) });
  await s.selectOwner('a'); await s.sync(); s.answer(answer); await s.flush(); await tick();
  await s.selectOwner('b'); await s.sync(); resolve(); await tick();
  assert.deepEqual(s.getState().answers, {}); assert.equal(s.getState().owner, 'b');
  assert.equal(JSON.parse(f.disk.get('a')!).pending.length, 1);
  assert.equal(JSON.parse(f.disk.get('b')!).pending.length, 0);
});
test('storage error does not claim durable progress or send before persistence', async () => {
  const f = fixture(); const s = createStudySync(f.deps);
  await s.selectOwner('a'); await s.sync(); f.failWrite(true);
  s.answer(answer); await s.flush(); await s.sync();
  assert.equal(f.requests(), 0); assert.equal(s.getState().storageError, true);
  f.failWrite(false); await s.sync();
  assert.equal(f.requests(), 1); assert.equal(s.getState().storageError, false);
});
test('guest attempts are not uploaded into a logged-in account', async () => {
  const f = fixture(); const s = createStudySync(f.deps);
  await s.selectOwner(null); s.answer(answer); await s.flush();
  await s.selectOwner('a'); await s.sync();
  assert.deepEqual(s.getState().answers, {}); assert.equal(f.requests(), 0);
  await s.selectOwner(null); assert.equal(s.getState().answers.q1.selected, 'B');
});
test('expired or switched session cannot issue a study mutation', async () => {
  let called = false;
  await assert.rejects(ownedStudyRequest('a', { getSession: async () => ({ data: { session: null } }) }, async () => { called = true; }));
  await assert.rejects(ownedStudyRequest('a', { getSession: async () => ({ data: { session: { user: { id: 'b' }, access_token: 'synthetic' } } }) }, async () => { called = true; }));
  assert.equal(called, false);
  const header = await ownedStudyRequest('a', { getSession: async () => ({ data: { session: { user: { id: 'a' }, access_token: 'synthetic' } } }) }, async auth => auth);
  assert.equal(header, 'Bearer synthetic');
});

test('a stalled session request times out without issuing a late write', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolve!: (value: { data: { session: { user: { id: string }; access_token: string } } }) => void;
  let called = false;
  const pending = ownedStudyRequest('a', { getSession: () => new Promise(r => { resolve = r; }) }, async () => { called = true; });
  const rejected = assert.rejects(pending, /timed out/);
  t.mock.timers.tick(15_001);
  await rejected;
  resolve({ data: { session: { user: { id: 'a' }, access_token: 'synthetic' } } });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(called, false);
});

test('invalidating an erased account fences replies but keeps subscriptions usable', async () => {
  const f = fixture(); const s = createStudySync(f.deps);
  let notifications = 0; s.subscribe(() => { notifications++; });
  await s.selectOwner('a'); await s.sync();
  s.invalidate(); await s.flush(); f.disk.delete('a');
  await s.selectOwner(null); s.answer(answer); await s.flush();
  assert.equal(s.getState().answers.q1.selected, 'B');
  assert.ok(notifications > 3);
});

test('lost acknowledgement retries one logical answer without duplicating the result', async () => {
  const f = fixture(); let loseAcknowledgement = true;
  const s = createStudySync({ ...f.deps, send: async (owner, mutation) => {
    await f.deps.send(owner, mutation);
    if (loseAcknowledgement) throw new Error('connection closed after commit');
  } });
  await s.selectOwner('a'); await s.sync();
  s.answer(answer); await s.flush(); await s.sync();
  assert.equal(s.getState().pending, 1);
  loseAcknowledgement = false; await s.sync();
  assert.equal(s.getState().pending, 0);
  assert.equal(Object.keys(f.server.get('a')!).length, 1);
  assert.equal(s.answer(answer), false);
});
