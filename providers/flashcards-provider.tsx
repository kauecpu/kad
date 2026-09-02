import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { flashcardsStorageKey } from '@/lib/local-user-data-keys';
import {
  addCardToStore,
  addDeckToStore,
  archiveCardInStore,
  restoreCardInStore,
  restoreDeckInStore,
  createCard,
  createDeck,
  createInitialFlashcardState,
  dueCards,
  filterFlashcards,
  reviewCardInStore,
  type FlashcardFilter,
  type FlashcardStoreState,
} from '@/lib/flashcards';
import { protectedStorage } from '@/lib/protected-storage';
import { loadRemoteFlashcards, removeRemoteCard, removeRemoteDeck, saveRemoteCard, saveRemoteDeck, saveRemoteReview } from '@/lib/remote-flashcards';
import { useAuth } from '@/providers/auth-provider';
import { levelEventId, useLevels } from '@/providers/levels-provider';
import type { Flashcard, FlashcardDeck, FlashcardRating } from '@/types';

type FlashcardsContextValue = FlashcardStoreState & {
  hydrated: boolean;
  due: Flashcard[];
  createDeck: (input: Omit<Parameters<typeof createDeck>[0], 'userId'>) => FlashcardDeck;
  createCard: (input: Omit<Parameters<typeof createCard>[0], 'userId'>) => Flashcard;
  updateDeck: (deckId: string, patch: Partial<Pick<FlashcardDeck, 'name' | 'description' | 'color'>>) => void;
  updateCard: (cardId: string, patch: Partial<Pick<Flashcard, 'front' | 'back' | 'tags' | 'deckId'>>) => void;
  archiveDeck: (deckId: string) => void;
  archiveCard: (cardId: string) => void;
  restoreDeck: (deckId: string) => void;
  restoreCard: (cardId: string) => void;
  deleteDeck: (deckId: string) => void;
  deleteCard: (cardId: string) => void;
  reviewCard: (cardId: string, rating: FlashcardRating) => void;
  filter: (filter: FlashcardFilter) => Flashcard[];
};

const FlashcardsContext = createContext<FlashcardsContextValue | null>(null);

function isState(value: unknown): value is FlashcardStoreState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<FlashcardStoreState>;
  return Array.isArray(candidate.decks) && Array.isArray(candidate.cards) && Array.isArray(candidate.reviews);
}

export function FlashcardsProvider({ children }: { children: ReactNode }) {
  const { record: recordLevel } = useLevels();
  const { user } = useAuth();
  const ownerId = user?.id ?? 'guest';
  const storageKey = flashcardsStorageKey(ownerId);
  const [state, setState] = useState<FlashcardStoreState>(createInitialFlashcardState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    setHydrated(false);
    setState(createInitialFlashcardState());
    protectedStorage
      .getItem(storageKey, ownerId, (raw) => isState(JSON.parse(raw)))
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as FlashcardStoreState;
            if (isState(parsed)) setState(parsed);
          } catch {
            // Dados inválidos não interrompem a entrada no app.
          }
        }
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [ownerId, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    protectedStorage.setItem(storageKey, ownerId, JSON.stringify(state)).catch(() => {
      // A cópia em memória continua disponível se o armazenamento falhar.
    });
  }, [hydrated, ownerId, state, storageKey]);

  useEffect(() => {
    if (!hydrated || !user?.id) return;
    let active = true;
    loadRemoteFlashcards(user.id).then((remote) => {
      if (!active) return;
      setState((current) => {
        const decks = [...current.decks];
        for (const remoteDeck of remote.decks) {
          const index = decks.findIndex((deck) => deck.id === remoteDeck.id);
          if (index < 0) decks.push(remoteDeck);
          else if (remoteDeck.updatedAt > decks[index].updatedAt) decks[index] = remoteDeck;
        }
        const cards = [...current.cards];
        for (const remoteCard of remote.cards) {
          const index = cards.findIndex((card) => card.id === remoteCard.id);
          if (index < 0) cards.push(remoteCard);
          else if (remoteCard.updatedAt > cards[index].updatedAt) cards[index] = remoteCard;
        }
        const reviews = [...current.reviews];
        for (const review of remote.reviews) if (!reviews.some((item) => item.id === review.id)) reviews.push(review);
        return { decks, cards, reviews };
      });
    }).catch(() => {
      // O cache local continua disponível se a sincronização não estiver pronta.
    });
    return () => { active = false; };
  }, [hydrated, user?.id]);

  const createDeckAction = useCallback((input: Omit<Parameters<typeof createDeck>[0], 'userId'>) => {
    const existing = state.decks.find((deck) => deck.userId === ownerId && !deck.archivedAt && deck.name.trim().toLocaleLowerCase('pt-BR') === input.name.trim().toLocaleLowerCase('pt-BR'));
    if (existing) return existing;
    const deck = createDeck({ ...input, userId: ownerId });
    setState((current) => addDeckToStore(current, deck));
    if (user?.id) saveRemoteDeck(deck).catch(() => {});
    return deck;
  }, [ownerId, state.decks, user?.id]);

  const createCardAction = useCallback((input: Omit<Parameters<typeof createCard>[0], 'userId'>) => {
    const existing = state.cards.find((card) => card.userId === ownerId && !card.archivedAt && card.deckId === input.deckId && card.front.trim().toLocaleLowerCase('pt-BR') === input.front.trim().toLocaleLowerCase('pt-BR') && card.back.trim().toLocaleLowerCase('pt-BR') === input.back.trim().toLocaleLowerCase('pt-BR'));
    if (existing) return existing;
    const card = createCard({ ...input, userId: ownerId });
    setState((current) => addCardToStore(current, card));
    if (user?.id) saveRemoteCard(card).catch(() => {});
    return card;
  }, [ownerId, state.cards, user?.id]);

  const updateDeck = useCallback((deckId: string, patch: Partial<Pick<FlashcardDeck, 'name' | 'description' | 'color'>>) => {
    setState((current) => {
      const deck = current.decks.find((item) => item.id === deckId);
      const nextDeck = deck ? { ...deck, ...patch, updatedAt: new Date().toISOString() } : undefined;
      if (nextDeck && user?.id) saveRemoteDeck(nextDeck).catch(() => {});
      return {
      ...current,
      decks: current.decks.map((item) => item.id === deckId ? nextDeck! : item),
      };
    });
  }, [user?.id]);

  const updateCard = useCallback((cardId: string, patch: Partial<Pick<Flashcard, 'front' | 'back' | 'tags' | 'deckId'>>) => {
    setState((current) => {
      const next = current.cards.map((card) => card.id === cardId ? { ...card, ...patch, updatedAt: new Date().toISOString() } : card);
      const changed = next.find((card) => card.id === cardId);
      if (changed && user?.id) saveRemoteCard(changed).catch(() => {});
      return { ...current, cards: next, decks: current.decks.map((deck) => ({ ...deck, cardCount: next.filter((card) => card.deckId === deck.id && !card.archivedAt).length })) };
    });
  }, [user?.id]);

  const archiveCard = useCallback((cardId: string) => setState((current) => {
    const next = archiveCardInStore(current, cardId);
    const changed = next.cards.find((card) => card.id === cardId);
    if (changed && user?.id) saveRemoteCard(changed).catch(() => {});
    return next;
  }), [user?.id]);
  const restoreCard = useCallback((cardId: string) => setState((current) => {
    const next = restoreCardInStore(current, cardId);
    const changed = next.cards.find((card) => card.id === cardId);
    if (changed && user?.id) saveRemoteCard(changed).catch(() => {});
    return next;
  }), [user?.id]);
  const archiveDeck = useCallback((deckId: string) => {
    setState((current) => {
      const archivedAt = new Date().toISOString();
      const deck = current.decks.find((item) => item.id === deckId);
      const nextDeck = deck ? { ...deck, archivedAt, updatedAt: archivedAt } : undefined;
      if (nextDeck && user?.id) saveRemoteDeck(nextDeck).catch(() => {});
      const nextCards = current.cards.map((card) => card.deckId === deckId ? { ...card, archivedAt, updatedAt: archivedAt } : card);
      if (user?.id) nextCards.filter((card) => card.deckId === deckId).forEach((card) => saveRemoteCard(card).catch(() => {}));
      return {
      ...current,
      decks: current.decks.map((item) => item.id === deckId ? { ...nextDeck!, cardCount: 0 } : item),
      cards: nextCards,
      };
    });
  }, [user?.id]);
  const restoreDeck = useCallback((deckId: string) => setState((current) => {
    const next = restoreDeckInStore(current, deckId);
    const deck = next.decks.find((item) => item.id === deckId);
    if (deck && user?.id) saveRemoteDeck(deck).catch(() => {});
    if (user?.id) next.cards.filter((card) => card.deckId === deckId).forEach((card) => saveRemoteCard(card).catch(() => {}));
    return next;
  }), [user?.id]);
  const deleteCard = useCallback((cardId: string) => { setState((current) => { const cards = current.cards.filter((card) => card.id !== cardId); return { ...current, cards, decks: current.decks.map((deck) => ({ ...deck, cardCount: cards.filter((card) => card.deckId === deck.id && !card.archivedAt).length })) }; }); if (user?.id) removeRemoteCard(user.id, cardId).catch(() => {}); }, [user?.id]);
  const deleteDeck = useCallback((deckId: string) => { setState((current) => ({ ...current, decks: current.decks.filter((deck) => deck.id !== deckId), cards: current.cards.filter((card) => card.deckId !== deckId) })); if (user?.id) removeRemoteDeck(user.id, deckId).catch(() => {}); }, [user?.id]);
  const reviewCard = useCallback((cardId: string, rating: FlashcardRating) => setState((current) => { const next = reviewCardInStore(current, cardId, rating); const card = next.cards.find((item) => item.id === cardId); const review = next.reviews[next.reviews.length - 1]; if (card && user?.id) saveRemoteCard(card).catch(() => {}); if (review && review.cardId === cardId) { if (user?.id) saveRemoteReview(review).catch(() => {}); recordLevel({ id: levelEventId(), kind: 'flashcard', itemId: cardId, rating, occurredAt: review.reviewedAt }); } return next; }), [recordLevel, user?.id]);
  const filter = useCallback((criteria: FlashcardFilter) => filterFlashcards(state.cards, criteria), [state.cards]);
  const due = useMemo(() => dueCards(state.cards), [state.cards]);

  const value = useMemo(() => ({ ...state, hydrated, due, createDeck: createDeckAction, createCard: createCardAction, updateDeck, updateCard, archiveDeck, archiveCard, restoreDeck, restoreCard, deleteDeck, deleteCard, reviewCard, filter }), [archiveCard, archiveDeck, createCardAction, createDeckAction, deleteCard, deleteDeck, due, filter, hydrated, restoreCard, restoreDeck, reviewCard, state, updateCard, updateDeck]);
  return <FlashcardsContext.Provider value={value}>{children}</FlashcardsContext.Provider>;
}

export function useFlashcards() {
  const context = useContext(FlashcardsContext);
  if (!context) throw new Error('useFlashcards precisa ser usado dentro de FlashcardsProvider.');
  return context;
}

