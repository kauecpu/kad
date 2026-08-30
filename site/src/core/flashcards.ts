import type {
  Flashcard,
  FlashcardDeck,
  FlashcardRating,
  FlashcardReview,
} from '../types/domain.ts';

export type FlashcardState = {
  decks: FlashcardDeck[];
  cards: Flashcard[];
  reviews: FlashcardReview[];
};

export type FlashcardFilter = {
  query?: string;
  deckId?: string;
  state?: 'active' | 'archived' | 'all';
};

type NewDeck = { userId: string; name: string; description?: string; color?: string };
type NewCard = { userId: string; deckId: string; front: string; back: string; tags?: string[] };

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

function newest<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const records = new Map<string, T>();
  for (const candidate of [...local, ...remote]) {
    const current = records.get(candidate.id);
    if (!current || Date.parse(candidate.updatedAt) >= Date.parse(current.updatedAt)) {
      records.set(candidate.id, candidate);
    }
  }
  return [...records.values()];
}

export function withDeckCounts(state: FlashcardState): FlashcardState {
  return {
    ...state,
    decks: state.decks.map((deck) => ({
      ...deck,
      cardCount: state.cards.filter((card) => card.deckId === deck.id && !card.archivedAt).length,
    })),
  };
}

export function mergeFlashcardStates(local: FlashcardState, remote: FlashcardState): FlashcardState {
  const reviews = new Map(local.reviews.map((review) => [review.id, review]));
  remote.reviews.forEach((review) => reviews.set(review.id, review));
  return withDeckCounts({
    decks: newest(local.decks, remote.decks),
    cards: newest(local.cards, remote.cards),
    reviews: [...reviews.values()].sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt)),
  });
}

export function createDeck(input: NewDeck, now = new Date()): FlashcardDeck {
  const createdAt = iso(now);
  return {
    id: `deck-${hashId(`${input.userId}|${input.name.trim()}|${createdAt}`)}`,
    userId: input.userId,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    color: input.color || undefined,
    cardCount: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createCard(input: NewCard, now = new Date()): Flashcard {
  const createdAt = iso(now);
  const front = input.front.trim();
  const back = input.back.trim();
  if (!front) throw new Error('A frente é obrigatória.');
  if (!back) throw new Error('O verso é obrigatório.');
  return {
    id: `card-${hashId(`${input.userId}|${input.deckId}|${front}|${createdAt}`)}`,
    userId: input.userId,
    deckId: input.deckId,
    front,
    back,
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

export function dueCards(cards: Flashcard[], now = new Date()): Flashcard[] {
  const timestamp = now.getTime();
  return cards
    .filter((card) => !card.archivedAt && card.state !== 'suspended' && Date.parse(card.dueAt) <= timestamp)
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.id.localeCompare(right.id));
}

export function filterFlashcards(cards: Flashcard[], filter: FlashcardFilter): Flashcard[] {
  const query = (filter.query ?? '').trim().toLocaleLowerCase('pt-BR');
  const state = filter.state ?? 'active';
  return cards.filter((card) => {
    if (state === 'active' && card.archivedAt) return false;
    if (state === 'archived' && !card.archivedAt) return false;
    if (filter.deckId && filter.deckId !== 'all' && card.deckId !== filter.deckId) return false;
    if (query && !`${card.front} ${card.back} ${card.tags.join(' ')}`.toLocaleLowerCase('pt-BR').includes(query)) return false;
    return true;
  });
}

export function scheduleReview(
  card: Flashcard,
  rating: FlashcardRating,
  reviewedAt = new Date(),
): { card: Flashcard; review: FlashcardReview } {
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
    card: next,
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

export function archiveCard(state: FlashcardState, cardId: string, now = new Date()): FlashcardState {
  const timestamp = iso(now);
  return withDeckCounts({
    ...state,
    cards: state.cards.map((card) => card.id === cardId
      ? { ...card, archivedAt: timestamp, updatedAt: timestamp }
      : card),
  });
}

export function restoreCard(state: FlashcardState, cardId: string, now = new Date()): FlashcardState {
  const timestamp = iso(now);
  return withDeckCounts({
    ...state,
    cards: state.cards.map((card) => card.id === cardId
      ? { ...card, archivedAt: undefined, updatedAt: timestamp }
      : card),
  });
}

export function archiveDeck(state: FlashcardState, deckId: string, now = new Date()): FlashcardState {
  const timestamp = iso(now);
  return withDeckCounts({
    ...state,
    decks: state.decks.map((deck) => deck.id === deckId
      ? { ...deck, archivedAt: timestamp, updatedAt: timestamp }
      : deck),
    cards: state.cards.map((card) => card.deckId === deckId
      ? { ...card, archivedAt: timestamp, updatedAt: timestamp }
      : card),
  });
}

export function restoreDeck(state: FlashcardState, deckId: string, now = new Date()): FlashcardState {
  const timestamp = iso(now);
  return withDeckCounts({
    ...state,
    decks: state.decks.map((deck) => deck.id === deckId
      ? { ...deck, archivedAt: undefined, updatedAt: timestamp }
      : deck),
    cards: state.cards.map((card) => card.deckId === deckId
      ? { ...card, archivedAt: undefined, updatedAt: timestamp }
      : card),
  });
}
