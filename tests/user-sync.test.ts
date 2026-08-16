import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isSimulationSession,
  mergeSimulationSessions,
  newestEssay,
  nextSyncTimestamp,
  parseStoredEssay,
} from '../lib/user-sync.ts';
import type { EssayDocument, SimulationSession } from '../types/index.ts';

function simulation(
  id: string,
  status: SimulationSession['status'],
  updatedAt: string
): SimulationSession {
  return {
    id,
    status,
    config: {
      disciplines: [],
      topics: [],
      boards: [],
      years: [],
      difficulties: [],
      questionCount: 1,
      durationMinutes: 20,
      shuffleQuestions: false,
      shuffleAlternatives: false,
    },
    questions: [{ questionId: 'q-1', alternativeOrder: ['A', 'B', 'C', 'D', 'E'] }],
    answers: status === 'completed' ? { 'q-1': 'A' } : {},
    currentIndex: 0,
    remainingSeconds: status === 'completed' ? 0 : 1200,
    createdAt: '2026-08-16T10:00:00.000Z',
    completedAt: status === 'completed' ? updatedAt : undefined,
    updatedAt,
  };
}

test('troca de aparelho preserva a versão mais recente do mesmo simulado', () => {
  const local = simulation('sim-1', 'paused', '2026-08-16T10:05:00.000Z');
  const remote = {
    ...simulation('sim-1', 'paused', '2026-08-16T10:06:00.000Z'),
    remainingSeconds: 600,
  };
  const merged = mergeSimulationSessions([local], [remote]);
  assert.equal(merged.session?.remainingSeconds, 600);
  assert.equal(merged.session?.updatedAt, remote.updatedAt);
});

test('simulado em andamento continua sendo a sessão atual e resultados ficam no histórico', () => {
  const active = simulation('sim-active', 'active', '2026-08-16T10:05:00.000Z');
  const completed = simulation('sim-completed', 'completed', '2026-08-16T10:10:00.000Z');
  const merged = mergeSimulationSessions([], [completed, active]);
  assert.equal(merged.session?.id, active.id);
  assert.deepEqual(merged.history.map((item) => item.id), [completed.id]);
});

test('payload remoto inválido não é aceito como sessão', () => {
  assert.equal(isSimulationSession({ id: 'malicioso', status: 'completed', answers: {} }), false);
  assert.equal(
    isSimulationSession({
      ...simulation('sim-1', 'active', '2026-08-16T10:05:00.000Z'),
      answers: { 'q-1': 'Z' },
    }),
    false
  );
});

test('rascunho local legado é migrado e a redação mais nova vence o conflito', () => {
  const local = parseStoredEssay('Texto salvo no aparelho', 'tema-1');
  assert.equal(local?.content, 'Texto salvo no aparelho');
  assert.equal(local?.status, 'draft');
  assert.equal(parseStoredEssay('123', 'tema-1')?.content, '123');

  const remote: EssayDocument = {
    topicId: 'tema-1',
    content: 'Texto atualizado em outro aparelho',
    elapsedSeconds: 480,
    status: 'submitted',
    submittedAt: '2026-08-16T11:00:00.000Z',
    updatedAt: '2026-08-16T11:00:00.000Z',
  };
  assert.equal(newestEssay(local, remote)?.content, remote.content);
});

test('relógio atrasado ainda produz uma versão posterior à recebida do servidor', () => {
  assert.equal(
    nextSyncTimestamp('2026-08-16T12:00:00.000Z', '2026-08-16T11:00:00.000Z'),
    '2026-08-16T12:00:00.001Z'
  );
});
