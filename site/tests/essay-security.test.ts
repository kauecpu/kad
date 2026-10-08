import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { createStore } from '../src/core/store.ts';
import { getCatalog } from '../src/data/catalog.ts';

const main = ts.createSourceFile('main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
function harness() {
  const callbacks: Array<() => void> = [];
  const store = createStore(undefined);
  let synced = 0;
  const ui = { essayBuffer: null as { topicId: string; content: string } | null };
  const deps = { ui, store, getCatalog, stopPageTimers() {}, document: { querySelector() { return null; } },
    setInterval(callback: () => void) { callbacks.push(callback); return 1; }, queueEssaySync() { synced++; } };
  const load = (name: string) => {
    const fn = main.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(fn);
    return new Function(...Object.keys(deps), `${stripTypeScriptTypes(fn.getText(main))};return ${name};`)(...Object.values(deps));
  };
  return { callbacks, store, ui, load, synced: () => synced };
}

test('timer e buffer ignoram tema inexistente e chaves herdadas sem poluir protótipos', () => {
  for (const topic of ['__proto__', 'constructor', 'prototype', 'toString', 'not-a-topic']) {
    const h = harness();
    const descriptors = Object.getOwnPropertyDescriptors(Object.prototype);
    try {
      h.load('startPageTimers')({ pathname: '/redacao', params: { topic, stage: 'write' } }, h.store.getState());
      assert.equal(h.callbacks.length, 0, topic);
      h.ui.essayBuffer = { topicId: topic, content: 'fixture' };
      h.load('persistEssayBuffer')();
      assert.deepEqual(h.store.getState().essays, {});
      assert.equal(h.synced(), 0);
      assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), descriptors);
    } finally {
      for (const key of Object.getOwnPropertyNames(Object.prototype)) {
        if (!Object.hasOwn(descriptors, key)) Reflect.deleteProperty(Object.prototype, key);
      }
    }
  }
});

test('tema válido preserva rascunho, incrementa timer e sincroniza; revisão não inicia timer', () => {
  const h = harness();
  const topic = getCatalog().essayTopics[0].id;
  h.ui.essayBuffer = { topicId: topic, content: 'Minha redação de teste' };
  h.load('persistEssayBuffer')();
  h.load('startPageTimers')({ pathname: '/redacao', params: { topic } }, h.store.getState());
  assert.equal(h.callbacks.length, 1);
  for (let i = 0; i < 5; i++) h.callbacks[0]();
  assert.equal(h.store.getState().essays[topic].elapsedSeconds, 5);
  assert.equal(h.store.getState().essays[topic].content, 'Minha redação de teste');
  assert.equal(h.synced(), 2);
  const review = harness();
  review.load('startPageTimers')({ pathname: '/redacao', params: { topic, stage: 'review' } }, review.store.getState());
  assert.equal(review.callbacks.length, 0);
});
