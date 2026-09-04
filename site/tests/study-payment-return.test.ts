import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('return handlers preserve study sync and subscription refresh without crossing accounts', async () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const start = main.indexOf('let subscriptionRefreshPending = false;');
  const end = main.indexOf('levelTracker.subscribe(() => render());', start);
  assert.ok(start >= 0 && end > start);
  const source = ts.transpileModule(main.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const events = new Map<string, (() => void)[]>();
  const register = (name: string, fn: () => void) => events.set(name, [...events.get(name) ?? [], fn]);
  const fire = (name: string) => events.get(name)?.forEach(fn => fn());
  let owner = 'fixture-a';
  const state = { subscription: { plan: 'basic' }, answers: {} };
  const subscribers: (() => void)[] = [];
  const selected: string[] = [];
  let syncs = 0;
  let reads = 0;
  let complete!: (value: { plan: string }) => void;
  const document = { visibilityState: 'visible', addEventListener: register };
  vm.runInNewContext(source, {
    document, addEventListener: register,
    store: {
      getState: () => state, getOwnerId: () => owner,
      subscribe: (fn: () => void) => subscribers.push(fn),
      update: (fn: (draft: typeof state) => void) => { fn(state); subscribers.forEach(callback => callback()); },
    },
    studySync: { subscribe() {}, selectOwner: (next: string) => { selected.push(next); }, sync: async () => { syncs++; } },
    paymentActionScope: { observe: () => { const captured = owner; return { userId: captured, isCurrent: () => owner === captured }; } },
    loadRemoteSubscription: async () => { reads++; return new Promise(resolve => { complete = resolve; }); },
    withPaymentTimeout: (request: Promise<unknown>) => request,
    ui: { visitedQuestionIds: new Set(), questionIndex: 0 }, levelReviewReady: new Set(),
    resetQuestionSession() {}, render() {}, studySyncMessage: () => '',
  });
  assert.equal(subscribers.length, 1, 'only the owner-aware store subscription should remain');
  assert.deepEqual(selected, ['fixture-a']);
  fire('focus'); fire('focus');
  assert.equal(reads, 1, 'subscription requests stay single-flight');
  assert.equal(syncs, 2, 'both focus events reach the study controller');
  owner = 'fixture-b'; subscribers.forEach(fn => fn());
  complete({ plan: 'diamond' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.subscription.plan, 'basic', 'late response from A cannot change B');
  assert.deepEqual(selected, ['fixture-a', 'fixture-b']);
  document.visibilityState = 'hidden'; fire('visibilitychange');
  assert.equal(reads, 1); assert.equal(syncs, 2);
  document.visibilityState = 'visible'; fire('visibilitychange');
  assert.equal(reads, 2); assert.equal(syncs, 3);
  complete({ plan: 'diamond' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.subscription.plan, 'diamond');
  fire('online'); assert.equal(syncs, 4); assert.equal(reads, 2);
});
