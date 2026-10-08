import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { createSimulationAccess } from '../src/core/simulation-access.ts';
import { createStore } from '../src/core/store.ts';
import { createSimulation, simulationConfigView } from '../src/views/simulations.ts';
import { plansView } from '../src/views/profile.ts';
import type { Subscription } from '../src/types/domain.ts';

const paid: Subscription = { plan: 'diamond', status: 'active', autoRenew: true, renewsAt: '2099-01-01T00:00:00Z' };
const basic: Subscription = { plan: 'basic', status: 'inactive', autoRenew: false };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test('visitante não consulta assinatura e falha fechada; acesso válido é consultado no servidor', async () => {
  let calls = 0;
  const context = { userId: null as string | null, route: '/simulados/configurar' };
  const access = createSimulationAccess(() => ({ ...context }), async () => { calls++; return paid; });
  assert.equal(await access.check(), 'login');
  assert.equal(calls, 0);
  context.userId = 'test-a';
  assert.equal(await access.check(), 'allowed');
  assert.equal(calls, 1);
});

test('gratuito, vencido, cancelado vencido e falha de rede não criam autorização', async () => {
  for (const subscription of [basic, { ...paid, status: 'expired' as const }, { ...paid, status: 'canceled' as const, renewsAt: '2020-01-01' }]) {
    const access = createSimulationAccess(() => ({ userId: 'test-a', route: '/' }), async () => subscription);
    assert.equal(await access.check(), 'subscription');
  }
  for (const load of [async () => null, async () => { throw new Error('offline'); }]) {
    assert.equal(await createSimulationAccess(() => ({ userId: 'test-a', route: '/' }), load).check(), 'unavailable');
  }
  assert.equal(await createSimulationAccess(() => ({ userId: 'test-a', route: '/' }), async () => ({ ...paid, status: 'canceled' })).check(), 'allowed');
});

test('troca de conta, logout, retorno à mesma conta, navegação e clique repetido invalidam consultas', async () => {
  for (const change of ['account', 'logout', 'aba', 'route', 'retry']) {
    const context = { userId: 'test-a' as string | null, route: '/simulados/configurar' };
    const pending = deferred<Subscription>();
    const access = createSimulationAccess(() => ({ ...context }), () => pending.promise);
    let applied = false;
    const first = access.check(() => { applied = true; });
    let second: Promise<unknown> | undefined;
    if (change === 'account' || change === 'aba') { context.userId = 'test-b'; access.sync(); }
    if (change === 'aba') { context.userId = 'test-a'; access.sync(); }
    if (change === 'logout') access.clear();
    if (change === 'route') context.route = '/perfil';
    if (change === 'retry') second = access.check();
    pending.resolve(paid);
    assert.equal(await first, 'stale', change);
    assert.equal(applied, false, change);
    if (second) assert.equal(await second, 'allowed');
  }
});

test('URL direta não exibe formulário para visitante/gratuito; assinatura vencida não aparece ativa', () => {
  const state = createStore(undefined).getState();
  assert.doesNotMatch(simulationConfigView({}, state).content, /data-form="simulation-config"/);
  state.auth = { mode: 'authenticated', userId: 'test-a' };
  assert.doesNotMatch(simulationConfigView({}, state).content, /data-form="simulation-config"/);
  state.subscription = paid;
  assert.match(simulationConfigView({}, state).content, /data-form="simulation-config"/);
  state.subscription = { ...paid, status: 'canceled', renewsAt: '2020-01-01' };
  assert.doesNotMatch(simulationConfigView({}, state).content, /data-form="simulation-config"/);
  assert.doesNotMatch(plansView(state).subtitle ?? '', /está ativo/);
});

// Execute the actual form handler without bootstrapping DOM, Supabase or network.
const main = ts.createSourceFile('main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const formNode = main.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleForm');
assert.ok(formNode);
const handlerSource = stripTypeScriptTypes(formNode.getText(main));

test('formulário real não confia no plano do cache nem altera simulado existente quando negado', async () => {
  for (const result of ['login', 'subscription', 'unavailable', 'stale', 'allowed']) {
    const store = createStore(undefined, 'test-a');
    const previous = createSimulation({ questionCount: 5 });
    assert.ok(previous);
    store.update(state => { state.subscription = paid; state.simulations.current = previous; });
    let created = 0;
    let synced = 0;
    const dependencies = {
      readTextFormData: () => ({ questionCount: '5' }),
      updateFormMessage: () => {},
      simulationAccess: { check: async (apply: () => void) => { if (result === 'allowed') apply(); return result; } },
      createSimulation: () => { created++; return createSimulation({ questionCount: 5 }); },
      HTMLInputElement: class {},
      store,
      queueSimulationSync: () => { synced++; },
      navigate: () => {},
    };
    const handle = new Function(...Object.keys(dependencies), `${handlerSource}; return handleForm;`)(...Object.values(dependencies));
    await handle({ dataset: { form: 'simulation-config' }, reportValidity: () => true, elements: { namedItem: () => null } });
    assert.equal(created, result === 'allowed' ? 1 : 0, result);
    assert.equal(synced, created);
    if (result !== 'allowed') assert.deepEqual(store.getState().simulations.current, previous);
  }
});
