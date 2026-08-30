import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStore,
  LEGACY_STORAGE_KEY,
  recordAnswer,
  storageKeyForOwner,
} from '../src/core/store.ts';
import { parseRecoveryCallback } from '../src/core/auth-callback.ts';
import { createCard, createDeck, dueCards, mergeFlashcardStates, scheduleReview } from '../src/core/flashcards.ts';
import { createPasswordSecurity } from '../src/core/password-security.ts';
import { mergeEssayDocuments, mergeSimulationSessions, nextSyncTimestamp } from '../src/core/user-sync.ts';
import { filterQuestions, matchesPack, questionsPerformance } from '../src/core/utils.ts';
import { matchRoute, shouldOpenStudyHome } from '../src/core/router.ts';
import { questionSessionView, questionsIndexView } from '../src/views/questions.ts';
import { createSimulation, simulationScore, simulationsView } from '../src/views/simulations.ts';
import { getCatalog } from '../src/data/catalog.ts';
import type { StorageLike } from '../src/types/domain.ts';

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('estado local registra resposta, atividade e restaura dados persistidos', () => {
  const storage = memoryStorage();
  const first = createStore(storage);
  const question = getCatalog().questions[0];
  assert.ok(question);

  first.update((draft) => recordAnswer(draft, question, question.correct));
  const restored = createStore(storage).getState();

  assert.equal(restored.answers[question.id].isCorrect, true);
  assert.equal(questionsPerformance(restored.answers).accuracy, 100);
  assert.ok(Object.values(restored.activityByDate).flat().includes(question.id));
});
test('busca combina palavra-chave, disciplina e pacote sem misturar escopos', () => {
  const { questions, packs } = getCatalog();
  const pack = packs.find((item) => questions.some((question) => matchesPack(question, item)));
  assert.ok(pack);

  const candidates = filterQuestions(questions, { pack });
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((question) => matchesPack(question, pack)));

  const question = candidates[0];
  assert.ok(question);
  assert.deepEqual(
    filterQuestions(candidates, { discipline: question.discipline, keyword: question.board }),
    candidates.filter(
      (item) => item.discipline === question.discipline && item.board === question.board,
    ),
  );
});

test('simulado respeita quantidade, recebe respostas e calcula resultado', () => {
  const session = createSimulation({ questionCount: 5, durationMinutes: 10, shuffleQuestions: false });
  assert.ok(session);
  assert.equal(session.questions.length, 5);
  assert.equal(session.remainingSeconds, 600);

  const questions = getCatalog().questions;
  for (const id of session.questions.slice(0, 3).map((item) => item.questionId)) {
    const question = questions.find((item) => item.id === id);
    assert.ok(question);
    session.answers[id] = question.correct;
  }
  const score = simulationScore(session);
  assert.deepEqual(
    { total: score.total, answered: score.answered, correct: score.correct, blank: score.blank },
    { total: 5, answered: 3, correct: 3, blank: 2 },
  );
});

test('flashcards preservam o formato compartilhado e agendam revisão espaçada', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');
  const deck = createDeck({ userId: 'user-a', name: ' Constitucional ' }, now);
  const card = createCard({
    userId: 'user-a',
    deckId: deck.id,
    front: ' O que é controle difuso? ',
    back: 'Controle exercido em um caso concreto.',
    tags: ['controle', 'controle', ' CF '],
  }, now);

  assert.equal(card.front, 'O que é controle difuso?');
  assert.deepEqual(card.tags, ['controle', 'CF']);
  assert.deepEqual(dueCards([card], now).map((item) => item.id), [card.id]);

  const scheduled = scheduleReview(card, 'good', now);
  assert.equal(scheduled.card.state, 'review');
  assert.equal(scheduled.card.intervalDays, 1);
  assert.equal(scheduled.review.cardId, card.id);
  assert.deepEqual(dueCards([scheduled.card], now), []);
});

test('sincronização mantém a versão mais recente sem duplicar conteúdo do usuário', () => {
  const deck = createDeck({ userId: 'user-a', name: 'Português' }, new Date('2026-08-29T10:00:00.000Z'));
  const localCard = createCard({ userId: 'user-a', deckId: deck.id, front: 'Crase', back: 'Regra local' }, new Date('2026-08-29T10:00:00.000Z'));
  const remoteCard = { ...localCard, back: 'Regra atualizada', updatedAt: '2026-08-29T11:00:00.000Z' };
  const mergedCards = mergeFlashcardStates(
    { decks: [deck], cards: [localCard], reviews: [] },
    { decks: [deck], cards: [remoteCard], reviews: [] },
  );
  assert.equal(mergedCards.cards[0]?.back, 'Regra atualizada');
  assert.equal(mergedCards.decks[0]?.cardCount, 1);

  const mergedEssays = mergeEssayDocuments({
    tema: { topicId: 'tema', content: 'local', elapsedSeconds: 10, status: 'draft', updatedAt: '2026-08-29T10:00:00.000Z' },
  }, [{ topicId: 'tema', content: 'remoto', elapsedSeconds: 20, status: 'draft', updatedAt: '2026-08-29T11:00:00.000Z' }]);
  assert.equal(mergedEssays.tema?.content, 'remoto');
  assert.ok(nextSyncTimestamp('2026-08-29T12:00:00.000Z', '2026-08-29T11:00:00.000Z') > '2026-08-29T12:00:00.000Z');

  const completed = { ...createSimulation({ questionCount: 2, durationMinutes: 10, shuffleQuestions: false })!, status: 'completed' as const, completedAt: '2026-08-29T12:00:00.000Z', updatedAt: '2026-08-29T12:00:00.000Z' };
  assert.deepEqual(mergeSimulationSessions([], [completed]).history.map((item) => item.id), [completed.id]);
});

test('catálogos omitem métricas vazias até existir atividade real', () => {
  const state = createStore(memoryStorage()).getState();

  assert.doesNotMatch(questionsIndexView(state).content, /Seu progresso nas questões/);
  assert.doesNotMatch(simulationsView(state).content, /Resumo dos simulados/);

  const question = getCatalog().questions[0];
  assert.ok(question);
  recordAnswer(state, question, question.correct);
  assert.match(questionsIndexView(state).content, /Seu progresso nas questões/);
});

test('sessão identifica avanço sem resposta como questão pulada', () => {
  const state = createStore(memoryStorage()).getState();
  const ui = { questionIndex: 0, visitedQuestionIds: new Set<string>() };

  assert.match(questionSessionView(state, { limit: '2' }, ui).content, /Pular questão/);
  ui.questionIndex = 1;
  assert.match(questionSessionView(state, { limit: '2' }, ui).content, /Questão 1, pulada/);
});

test('roteador reconhece parâmetros sem aceitar rotas de tamanhos diferentes', () => {
  assert.deepEqual(matchRoute('/concursos/:id', '/concursos/tj-sp'), { id: 'tj-sp' });
  assert.equal(matchRoute('/concursos/:id', '/concursos/tj-sp/edital'), null);
});

test('roteador trata percent-encoding inválido sem derrubar a navegação', () => {
  assert.equal(matchRoute('/concursos/:id', '/concursos/%E0%A4%A'), null);
  assert.equal(matchRoute('/concursos/:id', '/concursos/%'), null);
  assert.deepEqual(matchRoute('/concursos/:id', '/concursos/tj%20sp'), { id: 'tj sp' });
  assert.deepEqual(matchRoute('/concursos/:id', '/concursos/tj-sp'), { id: 'tj-sp' });
});

test('estado local isola visitante e contas verificadas', () => {
  const storage = memoryStorage();
  const scoped = createStore(storage);
  scoped.update((draft) => {
    draft.profile.name = 'Visitante local';
    draft.essays.guest = {
      topicId: 'guest',
      content: 'texto guest',
      elapsedSeconds: 0,
      status: 'draft',
      updatedAt: '2026-08-23T00:00:00.000Z',
    };
  });

  scoped.switchOwner('user-a');
  scoped.update((draft) => {
    draft.auth = { mode: 'authenticated', userId: 'user-a' };
    draft.profile.name = 'Conta A';
    draft.answers.a = {
      questionId: 'a',
      subject: 'Teste',
      selected: 'A',
      isCorrect: true,
      answeredAt: '2026-08-23T00:00:00.000Z',
    };
    draft.favorites = ['questao-a'];
  });
  scoped.switchOwner('user-b');
  assert.equal(scoped.getState().profile.name, 'Visitante');
  assert.deepEqual(scoped.getState().answers, {});
  scoped.update((draft) => {
    draft.auth = { mode: 'authenticated', userId: 'user-b' };
    draft.profile.name = 'Conta B';
  });

  scoped.switchOwner(null);
  assert.equal(scoped.getState().profile.name, 'Visitante local');
  assert.equal(scoped.getState().essays.guest.content, 'texto guest');
  assert.deepEqual(scoped.getState().favorites, []);
  scoped.switchOwner('user-a');
  assert.equal(scoped.getState().profile.name, 'Conta A');
  assert.deepEqual(scoped.getState().favorites, ['questao-a']);
  assert.notEqual(storageKeyForOwner('user-a'), storageKeyForOwner('user-b'));
});

test('migração do estado antigo só remove a origem após persistir o proprietário', () => {
  const storage = memoryStorage();
  const legacy = {
    ...structuredClone(createStore(memoryStorage()).getState()),
    auth: { mode: 'authenticated', userId: 'legacy-user' },
    profile: { ...createStore(memoryStorage()).getState().profile, name: 'Legado' },
  };
  storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));

  const scoped = createStore(storage);
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), null);
  assert.ok(storage.getItem(storageKeyForOwner('legacy-user')));
  assert.equal(scoped.getState().profile.name, 'Visitante');
  scoped.switchOwner('legacy-user');
  assert.equal(scoped.getState().profile.name, 'Legado');
});

test('callback web aceita somente PKCE correlacionado na rota e origem esperadas', () => {
  const origin = 'https://estudar.kadconcursos.com.br';
  const flowId = '12345678abcdef';
  assert.deepEqual(
    parseRecoveryCallback(`${origin}/nova-senha?code=legitimo&sb_flow_id=${flowId}`, origin),
    { code: 'legitimo', flowId },
  );
  assert.equal(parseRecoveryCallback(`${origin}/inicio#access_token=atacante&refresh_token=x`, origin), null);
  assert.equal(parseRecoveryCallback(`${origin}/nova-senha?code=sem-correlacao`, origin), null);
  assert.equal(parseRecoveryCallback(`https://evil.example/nova-senha?code=x&sb_flow_id=${flowId}`, origin), null);
});

test('senhas exigem reautenticação ou callback de recuperação validado', async () => {
  type AuthCall =
    | ['exchange', string, { flowId: string }]
    | ['update', { password: string; current_password?: string }]
    | ['signOut', { scope: 'others' }];
  const calls: AuthCall[] = [];
  let currentUserId = 'user-a';
  const auth = {
    exchangeCodeForSession: async (code: string, options: { flowId: string }) => {
      calls.push(['exchange', code, options]);
      return { data: { session: { user: { id: 'user-a' } } }, error: null };
    },
    getUser: async () => ({ data: { user: { id: currentUserId } } }),
    updateUser: async (payload: { password: string; current_password?: string }) => {
      calls.push(['update', payload]);
      return { error: null };
    },
    signOut: async (options: { scope: 'others' }) => { calls.push(['signOut', options]); },
  };
  const security = createPasswordSecurity(auth);

  assert.deepEqual(await security.updateAuthenticated('', 'nova-senha'), {
    ok: false,
    reason: 'current-password-required',
  });
  assert.deepEqual(await security.updateRecovered('nova-senha'), {
    ok: false,
    reason: 'recovery-not-validated',
  });
  assert.equal(calls.length, 0);

  assert.deepEqual(await security.updateAuthenticated('senha-atual', 'nova-senha'), { ok: true });
  const updateCall = calls.find((call) => call[0] === 'update');
  assert.ok(updateCall);
  assert.deepEqual(updateCall[1], {
    password: 'nova-senha',
    current_password: 'senha-atual',
  });
  assert.deepEqual(
    await security.completeRecovery({ code: 'codigo', flowId: 'flow-12345678' }),
    { user: { id: 'user-a' } },
  );
  assert.deepEqual(await security.updateRecovered('recuperada'), { ok: true });
  assert.ok(calls.some((call) => call[0] === 'exchange' && call[2].flowId === 'flow-12345678'));

  const identityBoundRecovery = createPasswordSecurity(auth);
  await identityBoundRecovery.completeRecovery({ code: 'outro-codigo', flowId: 'flow-87654321' });
  currentUserId = 'user-b';
  const updatesBeforeMismatch = calls.filter((call) => call[0] === 'update').length;
  assert.deepEqual(await identityBoundRecovery.updateRecovered('não-alterar'), {
    ok: false,
    reason: 'recovery-not-validated',
  });
  assert.equal(calls.filter((call) => call[0] === 'update').length, updatesBeforeMismatch);
});

test('raiz abre o estudo apenas para conta ou visitante que já iniciou', () => {
  assert.equal(shouldOpenStudyHome('/', { auth: { mode: 'visitor' }, preferences: { hasStarted: false } }), false);
  assert.equal(shouldOpenStudyHome('/', { auth: { mode: 'visitor' }, preferences: { hasStarted: true } }), true);
  assert.equal(shouldOpenStudyHome('/', { auth: { mode: 'authenticated' }, preferences: { hasStarted: false } }), true);
  assert.equal(shouldOpenStudyHome('/entrar', { auth: { mode: 'authenticated' }, preferences: { hasStarted: true } }), false);
});
