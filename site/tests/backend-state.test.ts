import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyBackendState,
  isRemoteContentAuthoritative,
} from '../src/core/backend-state.ts';

test('configuração ausente é identificada explicitamente como modo offline', () => {
  assert.deepEqual(classifyBackendState({
    configured: false,
    loading: false,
    error: null,
    loadedFromRemote: false,
    questionCount: 12,
    concursoCount: 3,
  }), { connection: 'offline', content: 'local' });
});

test('catálogo remoto vazio continua sendo autoritativo quando a conexão existe', () => {
  assert.equal(isRemoteContentAuthoritative({
    configured: true,
    loadedFromRemote: true,
  }), true);
  assert.deepEqual(classifyBackendState({
    configured: true,
    loading: false,
    error: null,
    loadedFromRemote: true,
    questionCount: 0,
    concursoCount: 0,
  }), { connection: 'connected', content: 'empty' });
});

test('falha depois da configuração não é apresentada como catálogo local confiável', () => {
  assert.deepEqual(classifyBackendState({
    configured: true,
    loading: false,
    error: 'published-content-unavailable',
    loadedFromRemote: false,
    questionCount: 600,
    concursoCount: 10,
  }), { connection: 'error', content: 'unavailable' });
});
