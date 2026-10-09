import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { createStore } from '../src/core/store.ts';
import { isEssayDocument, nextSyncTimestamp } from '../src/core/user-sync.ts';
import { getCatalog } from '../src/data/catalog.ts';
import { essayView } from '../src/views/profile.ts';
import type { EssayDocument } from '../src/types/domain.ts';

// Exercise the production timer/buffer, without bootstrapping the page or network.
const main = ts.createSourceFile('main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
function harness() {
  const callbacks: Array<() => void> = [];
  const store = createStore(undefined);
  const synced: EssayDocument[] = [];
  const ui = { essayBuffer: null as { topicId: string; content: string } | null };
  const deps = { ui, store, getCatalog, nextSyncTimestamp, stopPageTimers() {}, document: { querySelector() { return null; } },
    setInterval(callback: () => void) { callbacks.push(callback); return 1; },
    queueEssaySync(document: EssayDocument) { synced.push(structuredClone(document)); } };
  const load = (name: string) => {
    const fn = main.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(fn);
    return new Function(...Object.keys(deps), `${stripTypeScriptTypes(fn.getText(main))};return ${name};`)(...Object.values(deps));
  };
  return { callbacks, store, ui, load, synced };
}

test('timer e buffer ignoram temas inexistentes e propriedades herdadas', () => {
  for (const topic of ['__proto__', 'constructor', 'prototype', 'toString', 'not-a-topic']) {
    const h = harness();
    h.load('startPageTimers')({ pathname: '/redacao', params: { topic, stage: 'write' } }, h.store.getState());
    assert.equal(h.callbacks.length, 0, topic);
    h.ui.essayBuffer = { topicId: topic, content: 'fixture' };
    h.load('persistEssayBuffer')();
    assert.deepEqual(h.store.getState().essays, {});
    assert.equal(h.synced.length, 0);
    assert.equal(h.ui.essayBuffer, null);
  }
});

test('rascunho novo e timer produzem documentos aceitos pelo contrato de sincronização', () => {
  for (const firstAction of ['write', 'timer']) {
    const h = harness();
    const topic = getCatalog().essayTopics[0].id;
    if (firstAction === 'write') {
      h.ui.essayBuffer = { topicId: topic, content: 'Minha redação fictícia' };
      h.load('persistEssayBuffer')();
    }
    h.load('startPageTimers')({ pathname: '/redacao', params: { topic } }, h.store.getState());
    assert.equal(h.callbacks.length, 1);
    for (let i = 0; i < 5; i++) h.callbacks[0]();
    assert.equal(h.store.getState().essays[topic].elapsedSeconds, 5);
    assert.equal(h.store.getState().essays[topic].content, firstAction === 'write' ? 'Minha redação fictícia' : '');
    assert.ok(h.synced.length > 0);
    assert.ok(h.synced.every(isEssayDocument), 'não basta enfileirar: o serviço precisa aceitar o documento');
  }
});

test('timer recupera identidade de rascunho legado sem perder texto ou tempo', () => {
  const h = harness();
  const topic = getCatalog().essayTopics[0].id;
  h.store.replace({ ...h.store.getState(), essays: { [topic]: {
    content: 'Texto antigo preservado', elapsedSeconds: 30, updatedAt: '2026-01-01T00:00:00Z',
  } } });
  h.load('startPageTimers')({ pathname: '/redacao', params: { topic } }, h.store.getState());
  for (let i = 0; i < 5; i++) h.callbacks[0]();
  assert.equal(h.synced[0].content, 'Texto antigo preservado');
  assert.equal(h.synced[0].elapsedSeconds, 35);
  assert.equal(isEssayDocument(h.synced[0]), true);
});

test('editar documento anteriormente submetido gera um rascunho válido', () => {
  const h = harness();
  const topic = getCatalog().essayTopics[0].id;
  h.store.update(state => { state.essays[topic] = { topicId: topic, content: 'Antes', elapsedSeconds: 10,
    status: 'submitted', submittedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }; });
  h.ui.essayBuffer = { topicId: topic, content: 'Depois' };
  h.load('persistEssayBuffer')();
  assert.equal(isEssayDocument(h.synced[0]), true);
  assert.equal(h.synced[0].content, 'Depois');
  assert.equal(h.synced[0].elapsedSeconds, 10);
});

test('revisão não inicia cronômetro e temas distintos preservam rascunhos separados', () => {
  const h = harness();
  for (const topic of getCatalog().essayTopics.slice(0, 2)) {
    h.ui.essayBuffer = { topicId: topic.id, content: `Texto ${topic.id}` };
    h.load('persistEssayBuffer')();
    h.load('startPageTimers')({ pathname: '/redacao', params: { topic: topic.id, stage: 'review' } }, h.store.getState());
  }
  assert.equal(h.callbacks.length, 0);
  for (const topic of getCatalog().essayTopics.slice(0, 2)) assert.equal(h.store.getState().essays[topic.id].content, `Texto ${topic.id}`);
});

test('login não é prova de sincronização da redação', () => {
  const state = createStore(undefined, 'fixture-user').getState();
  const view = essayView(state, { topic: getCatalog().essayTopics[0].id });
  assert.doesNotMatch(view.content, /Rascunho sincronizado com sua conta/);
  assert.match(view.content, /Rascunho salvo neste navegador/);
});
