import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { createStore } from '../src/core/store.ts';
import { nextSyncTimestamp, touchSimulationSession } from '../src/core/user-sync.ts';
import { createSimulation, simulationPlayerView } from '../src/views/simulations.ts';

// Real delegated click handler, including checks even if disabled is removed from HTML.
const main = ts.createSourceFile('main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const registration = main.statements.find(node => ts.isExpressionStatement(node)
  && ts.isCallExpression(node.expression) && node.expression.expression.getText(main) === 'document.addEventListener'
  && node.expression.arguments[0]?.getText(main) === "'click'");
assert.ok(registration && ts.isExpressionStatement(registration) && ts.isCallExpression(registration.expression));
const callback = stripTypeScriptTypes(registration.expression.arguments[1].getText(main));

function harness() {
  const store = createStore(undefined);
  const session = createSimulation({ questionCount: 5 });
  assert.ok(session);
  store.update(state => { state.simulations.current = session; });
  let synced = 0;
  class Element { closest() { return null; } }
  class Button extends Element { disabled = false; dataset: Record<string, string> = {}; }
  const deps = { store, Element, HTMLButtonElement: Button, actionFromElement: (target: Button) => target,
    isAlternativeId: (value: string) => ['A', 'B', 'C', 'D', 'E'].includes(value),
    nextSyncTimestamp, touchSimulationSession, queueSimulationSync: () => { synced++; } };
  const click = new Function(...Object.keys(deps), `return (${callback});`)(...Object.values(deps));
  return { store, session, synced: () => synced, async action(action: string, more = {}) {
    const target = new Button(); target.dataset = { action, ...more }; await click({ target });
  } };
}

test('pausa bloqueia botão e handler; retomada preserva respostas e permite continuar', async () => {
  const h = harness();
  const questionId = h.session.questions[0].questionId;
  const answer = (alternative: string) => h.action('answer-simulation', { questionId, alternative });
  await answer('A');
  await h.action('pause-simulation');
  const before = structuredClone(h.store.getState().simulations.current);
  const synced = h.synced();
  await answer('B');
  assert.deepEqual(h.store.getState().simulations.current, before);
  assert.equal(h.synced(), synced, 'resposta bloqueada não gera gravação');
  const view = simulationPlayerView(h.store.getState()).content;
  const buttons = view.match(/<button[^>]+data-action="answer-simulation"[^>]*>/g) ?? [];
  assert.ok(buttons.length > 0);
  assert.ok(buttons.every(tag => /\bdisabled\b/.test(tag)));
  assert.match(view, /Simulado pausado/);
  await h.action('resume-simulation');
  await answer('B');
  assert.equal(h.store.getState().simulations.current?.answers[questionId], 'B');
  assert.equal(h.store.getState().simulations.current?.remainingSeconds, before?.remainingSeconds);
});

test('cliques antigos não respondem nem reabrem simulado concluído', async () => {
  for (const action of ['answer-simulation', 'pause-simulation', 'resume-simulation']) {
    const h = harness();
    h.store.update(state => { state.simulations.current!.status = 'completed'; });
    const before = structuredClone(h.store.getState().simulations.current);
    await h.action(action, { questionId: h.session.questions[0].questionId, alternative: 'A' });
    assert.deepEqual(h.store.getState().simulations.current, before, action);
    assert.equal(h.synced(), 0, action);
  }
});
