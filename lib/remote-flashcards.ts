import { supabase } from '@/lib/supabase';
import type { Flashcard, FlashcardDeck, FlashcardReview } from '@/types';
import type { FlashcardStoreState } from '@/lib/flashcards';

const deckRow = (deck: FlashcardDeck, userId: string) => ({
  id: deck.id, user_id: userId, name: deck.name, description: deck.description ?? null,
  color: deck.color ?? null, archived_at: deck.archivedAt ?? null,
  created_at: deck.createdAt, updated_at: deck.updatedAt,
});

const cardRow = (card: Flashcard, userId: string) => ({
  id: card.id, user_id: userId, deck_id: card.deckId, front: card.front, back: card.back,
  tags: card.tags, state: card.state, repetitions: card.repetitions,
  interval_days: card.intervalDays, ease_factor: card.easeFactor, due_at: card.dueAt,
  archived_at: card.archivedAt ?? null, created_at: card.createdAt, updated_at: card.updatedAt,
});

const reviewRow = (review: FlashcardReview, userId: string) => ({
  id: review.id, user_id: userId, card_id: review.cardId, rating: review.rating,
  reviewed_at: review.reviewedAt, previous_due_at: review.previousDueAt, next_due_at: review.nextDueAt,
  created_at: review.reviewedAt,
});

function mapDeck(row: Record<string, unknown>): FlashcardDeck {
  return { id: String(row.id), userId: String(row.user_id), name: String(row.name), description: typeof row.description === 'string' ? row.description : undefined, color: typeof row.color === 'string' ? row.color : undefined, cardCount: 0, archivedAt: typeof row.archived_at === 'string' ? row.archived_at : undefined, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

function mapCard(row: Record<string, unknown>): Flashcard {
  return { id: String(row.id), userId: String(row.user_id), deckId: String(row.deck_id), front: String(row.front), back: String(row.back), tags: Array.isArray(row.tags) ? row.tags.map(String) : [], state: row.state as Flashcard['state'], repetitions: Number(row.repetitions), intervalDays: Number(row.interval_days), easeFactor: Number(row.ease_factor), dueAt: String(row.due_at), archivedAt: typeof row.archived_at === 'string' ? row.archived_at : undefined, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

function mapReview(row: Record<string, unknown>): FlashcardReview {
  return { id: String(row.id), userId: String(row.user_id), cardId: String(row.card_id), rating: row.rating as FlashcardReview['rating'], reviewedAt: String(row.reviewed_at), previousDueAt: String(row.previous_due_at), nextDueAt: String(row.next_due_at) };
}

export async function loadRemoteFlashcards(userId: string): Promise<FlashcardStoreState> {
  if (!supabase) return { decks: [], cards: [], reviews: [] };
  const [decks, cards, reviews] = await Promise.all([
    supabase.from('flashcard_decks').select('*').eq('user_id', userId),
    supabase.from('flashcards').select('*').eq('user_id', userId),
    supabase.from('flashcard_reviews').select('*').eq('user_id', userId),
  ]);
  const error = decks.error ?? cards.error ?? reviews.error;
  if (error) throw error;
  const mappedCards = (cards.data ?? []).map((row) => mapCard(row as Record<string, unknown>));
  return {
    decks: (decks.data ?? []).map((row) => ({ ...mapDeck(row as Record<string, unknown>), cardCount: mappedCards.filter((card) => card.deckId === row.id && !card.archivedAt).length })),
    cards: mappedCards,
    reviews: (reviews.data ?? []).map((row) => mapReview(row as Record<string, unknown>)),
  };
}

export async function saveRemoteDeck(deck: FlashcardDeck) {
  if (!supabase) return;
  const { error } = await supabase.from('flashcard_decks').upsert(deckRow(deck, deck.userId));
  if (error) throw error;
}

export async function saveRemoteCard(card: Flashcard) {
  if (!supabase) return;
  const { error } = await supabase.from('flashcards').upsert(cardRow(card, card.userId));
  if (error) throw error;
}

export async function saveRemoteReview(review: FlashcardReview) {
  if (!supabase) return;
  const { error } = await supabase.from('flashcard_reviews').upsert(reviewRow(review, review.userId), { onConflict: 'user_id,id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeRemoteDeck(userId: string, deckId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('flashcard_decks').delete().eq('user_id', userId).eq('id', deckId);
  if (error) throw error;
}

export async function removeRemoteCard(userId: string, cardId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('flashcards').delete().eq('user_id', userId).eq('id', cardId);
  if (error) throw error;
}
