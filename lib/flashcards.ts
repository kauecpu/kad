import type {
  Flashcard,
  FlashcardDeck,
  FlashcardRating,
  FlashcardReview,
} from '@/types';

type NewDeck = { userId: string; name: string; description?: string; color?: string };
type NewCard = { userId: string; deckId: string; front: string; back: string; tags?: string[] };

export type FlashcardStoreState = {
  decks: FlashcardDeck[];
  cards: Flashcard[];
  reviews: FlashcardReview[];
};

export type FlashcardFilter = {
  query: string;
  deckId: string;
  tag: string;
  state: 'active' | 'archived' | 'all';
};

function hashId(input: string): string {
  let hash = 2166136261;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function addMinutes(value: Date, minutes: number): string {
  return new Date(value.getTime() + minutes * 60_000).toISOString();
}

function addDays(value: Date, days: number): string {
  return new Date(value.getTime() + days * 86_400_000).toISOString();
}

export function validateCardInput(input: Pick<NewCard, 'front' | 'back'>): string | null {
  if (!input.front.trim()) return 'A frente é obrigatória.';
  if (!input.back.trim()) return 'O verso é obrigatório.';
  return null;
}

export function createDeck(input: NewDeck, now = new Date()): FlashcardDeck {
  const createdAt = iso(now);
  return {
    id: `deck-${hashId(`${input.userId}|${input.name.trim()}|${createdAt}`)}`,
    userId: input.userId,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    color: input.color,
    cardCount: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createCard(input: NewCard, now = new Date()): Flashcard {
  const error = validateCardInput(input);
  if (error) throw new Error(error);
  const createdAt = iso(now);
  return {
    id: `card-${hashId(`${input.userId}|${input.deckId}|${input.front.trim()}|${createdAt}`)}`,
    userId: input.userId,
    deckId: input.deckId,
    front: input.front.trim(),
    back: input.back.trim(),
    tags: Array.from(new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))),
    state: 'new',
    repetitions: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    dueAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}

export function scheduleReview(
  card: Flashcard,
  rating: FlashcardRating,
  reviewedAt = new Date(),
): Flashcard & { review: FlashcardReview } {
  const reviewedIso = iso(reviewedAt);
  const next = { ...card, updatedAt: reviewedIso };
  let dueAt: string;

  if (rating === 'again') {
    next.state = 'learning';
    dueAt = addMinutes(reviewedAt, 10);
  } else if (rating === 'hard') {
    next.state = 'review';
    next.repetitions += 1;
    next.intervalDays = Math.max(1, Math.round((card.intervalDays || 1) * 1.2));
    next.easeFactor = Math.max(1.3, card.easeFactor - 0.15);
    dueAt = addDays(reviewedAt, next.intervalDays);
  } else if (rating === 'good') {
    next.state = 'review';
    next.repetitions += 1;
    next.intervalDays = Math.max(1, card.intervalDays ? Math.round(card.intervalDays * card.easeFactor) : 1);
    dueAt = addDays(reviewedAt, next.intervalDays);
  } else {
    next.state = 'review';
    next.repetitions += 1;
    next.intervalDays = Math.max(2, card.intervalDays ? Math.round(card.intervalDays * card.easeFactor * 1.3) : 2);
    next.easeFactor += 0.15;
    dueAt = addDays(reviewedAt, next.intervalDays);
  }

  next.dueAt = dueAt;
  return {
    ...next,
    review: {
      id: `review-${hashId(`${card.id}|${reviewedIso}|${rating}`)}`,
      userId: card.userId,
      cardId: card.id,
      rating,
      reviewedAt: reviewedIso,
      previousDueAt: card.dueAt,
      nextDueAt: dueAt,
    },
  };
}

export function dueCards(cards: Flashcard[], now = new Date()): Flashcard[] {
  const timestamp = now.getTime();
  return cards
    .filter((card) => !card.archivedAt && card.state !== 'suspended' && new Date(card.dueAt).getTime() <= timestamp)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
}

export function createInitialFlashcardState(): FlashcardStoreState {
  return { decks: [], cards: [], reviews: [] };
}

function withDeckCounts(state: FlashcardStoreState): FlashcardStoreState {
  return {
    ...state,
    decks: state.decks.map((deck) => ({
      ...deck,
      cardCount: state.cards.filter((card) => card.deckId === deck.id && !card.archivedAt).length,
    })),
  };
}

export function addDeckToStore(state: FlashcardStoreState, deck: FlashcardDeck): FlashcardStoreState {
  if (state.decks.some((item) => item.id === deck.id)) return state;
  return { ...state, decks: [...state.decks, deck] };
}

export function addCardToStore(state: FlashcardStoreState, card: Flashcard): FlashcardStoreState {
  if (state.cards.some((item) => item.id === card.id)) return state;
  return withDeckCounts({ ...state, cards: [...state.cards, card] });
}

export function archiveCardInStore(
  state: FlashcardStoreState,
  cardId: string,
  archivedAt = new Date(),
): FlashcardStoreState {
  return withDeckCounts({
    ...state,
    cards: state.cards.map((card) =>
      card.id === cardId ? { ...card, archivedAt: iso(archivedAt), updatedAt: iso(archivedAt) } : card,
    ),
  });
}

export function restoreCardInStore(
  state: FlashcardStoreState,
  cardId: string,
  updatedAt = new Date(),
): FlashcardStoreState {
  return withDeckCounts({
    ...state,
    cards: state.cards.map((card) =>
      card.id === cardId ? { ...card, archivedAt: undefined, updatedAt: iso(updatedAt) } : card,
    ),
  });
}

export function restoreDeckInStore(
  state: FlashcardStoreState,
  deckId: string,
  updatedAt = new Date(),
): FlashcardStoreState {
  const timestamp = iso(updatedAt);
  return withDeckCounts({
    ...state,
    decks: state.decks.map((deck) => deck.id === deckId ? { ...deck, archivedAt: undefined, updatedAt: timestamp } : deck),
    cards: state.cards.map((card) => card.deckId === deckId ? { ...card, archivedAt: undefined, updatedAt: timestamp } : card),
  });
}

export function reviewCardInStore(
  state: FlashcardStoreState,
  cardId: string,
  rating: FlashcardRating,
  reviewedAt = new Date(),
): FlashcardStoreState {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card || card.archivedAt) return state;
  const result = scheduleReview(card, rating, reviewedAt);
  return {
    ...state,
    cards: state.cards.map((item) => (item.id === cardId ? result : item)),
    reviews: state.reviews.some((review) => review.id === result.review.id)
      ? state.reviews
      : [...state.reviews, result.review],
  };
}

export function filterFlashcards(cards: Flashcard[], filter: FlashcardFilter): Flashcard[] {
  const query = filter.query.trim().toLocaleLowerCase('pt-BR');
  const tag = filter.tag.trim().toLocaleLowerCase('pt-BR');
  return cards.filter((card) => {
    if (filter.state === 'active' && card.archivedAt) return false;
    if (filter.state === 'archived' && !card.archivedAt) return false;
    if (filter.deckId !== 'all' && card.deckId !== filter.deckId) return false;
    if (tag && !card.tags.some((item) => item.toLocaleLowerCase('pt-BR') === tag)) return false;
    if (query && !`${card.front} ${card.back} ${card.tags.join(' ')}`.toLocaleLowerCase('pt-BR').includes(query)) return false;
    return true;
  });
}

