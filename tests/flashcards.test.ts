import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addCardToStore,
  addDeckToStore,
  archiveCardInStore,
  createInitialFlashcardState,
  createCard,
  createDeck,
  dueCards,
  filterFlashcards,
  reviewCardInStore,
  scheduleReview,
  validateCardInput,
} from '../lib/flashcards.ts';
import type { Flashcard } from '../types/index.ts';

const now = new Date('2026-08-28T12:00:00.000Z');

test('valida frente e verso antes de criar um card', () => {
  assert.equal(validateCardInput({ front: '  ', back: 'Resposta' }), 'A frente é obrigatória.');
  assert.equal(validateCardInput({ front: 'Pergunta', back: '' }), 'O verso é obrigatório.');
  assert.equal(validateCardInput({ front: 'Pergunta', back: 'Resposta' }), null);
});

test('cria IDs estáveis e campos iniciais de um baralho e card', () => {
  const deck = createDeck({ userId: 'user-1', name: 'Direito' }, now);
  const card = createCard({ userId: 'user-1', deckId: deck.id, front: 'O que é RLS?', back: 'Row Level Security' }, now);

  assert.match(deck.id, /^deck-/);
  assert.equal(deck.cardCount, 0);
  assert.equal(card.state, 'new');
  assert.equal(card.repetitions, 0);
  assert.equal(card.dueAt, now.toISOString());
});

test('agenda novamente, difícil, acertei e fácil de forma determinística', () => {
  const card: Flashcard = {
    id: 'card-1', userId: 'user-1', deckId: 'deck-1', front: 'F', back: 'V', tags: [],
    state: 'new', repetitions: 0, intervalDays: 0, easeFactor: 2.5,
    dueAt: now.toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };

  assert.equal(scheduleReview(card, 'again', now).dueAt, '2026-08-28T12:10:00.000Z');
  assert.equal(scheduleReview(card, 'hard', now).dueAt, '2026-08-29T12:00:00.000Z');
  assert.equal(scheduleReview(card, 'good', now).dueAt, '2026-08-29T12:00:00.000Z');
  assert.equal(scheduleReview(card, 'easy', now).dueAt, '2026-08-30T12:00:00.000Z');
});

test('seleciona apenas cards vencidos e ordena pelos mais antigos', () => {
  const cards = [
    { id: 'later', dueAt: '2026-08-28T11:00:00.000Z' },
    { id: 'future', dueAt: '2026-08-29T11:00:00.000Z' },
    { id: 'older', dueAt: '2026-08-27T11:00:00.000Z' },
  ] as Flashcard[];
  assert.deepEqual(dueCards(cards, now).map((card) => card.id), ['older', 'later']);
});

test('operações da loja mantêm baralhos e cards privados e idempotentes', () => {
  const deck = createDeck({ userId: 'user-1', name: 'Direito' }, now);
  const card = createCard({ userId: 'user-1', deckId: deck.id, front: 'F', back: 'V' }, now);
  let state = createInitialFlashcardState();
  state = addDeckToStore(state, deck);
  state = addDeckToStore(state, deck);
  state = addCardToStore(state, card);
  state = addCardToStore(state, card);
  assert.equal(state.decks.length, 1);
  assert.equal(state.cards.length, 1);
  assert.equal(state.decks[0].cardCount, 1);

  state = archiveCardInStore(state, card.id, now);
  assert.ok(state.cards[0].archivedAt);
  assert.equal(filterFlashcards(state.cards, { query: '', deckId: 'all', tag: '', state: 'active' }).length, 0);
});

test('revisão atualiza o card na loja sem criar uma cópia', () => {
  const deck = createDeck({ userId: 'user-1', name: 'Direito' }, now);
  const card = createCard({ userId: 'user-1', deckId: deck.id, front: 'F', back: 'V' }, now);
  const state = addCardToStore(addDeckToStore(createInitialFlashcardState(), deck), card);
  const reviewed = reviewCardInStore(state, card.id, 'good', now);
  assert.equal(reviewed.cards.length, 1);
  assert.equal(reviewed.cards[0].repetitions, 1);
  assert.equal(reviewed.reviews.length, 1);
});
