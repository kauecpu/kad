# Flashcards MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a private, manual flashcard experience to the KAD app with deterministic spaced repetition and safe per-user persistence.

**Architecture:** A `FlashcardsProvider` owns decks, cards, and review scheduling. It persists immediately in protected local storage and synchronizes authenticated users with Supabase through RLS-protected tables. The `/flashcards` route renders summary, deck management, card creation/editing, filtering, and review session states using existing theme tokens and primitives.

**Tech Stack:** Expo Router, React Native, AsyncStorage/protected storage, Supabase JS, PostgreSQL migrations, Node test runner, TypeScript.

**Spec:** User-provided Flashcards MVP prompt in the conversation.

## Global Constraints

- Cards are manual, private, and not linked to questions in this MVP.
- Never alter official question data, answers, classifications, or explanations.
- Use existing KAD tokens/components; no hardcoded per-screen palette.
- Enforce per-user ownership with Supabase RLS and local owner-scoped storage.
- Do not use Qwen, external APIs, or production data during validation.

---

### Task 1: Domain model and deterministic scheduler

**Files:**
- Modify: `types/index.ts`
- Create: `lib/flashcards.ts`
- Test: `tests/flashcards.test.ts`

- [ ] Add types for `FlashcardDeck`, `Flashcard`, `FlashcardReview`, review ratings, and card state.
- [ ] Write failing tests for scheduling each rating, due-card selection, validation, and stable IDs.
- [ ] Implement a small deterministic scheduler with persisted interval, repetitions, ease factor, and `dueAt`.
- [ ] Run the focused tests and then the full test suite.

### Task 2: Private persistence and provider

**Files:**
- Modify: `lib/local-user-data-keys.ts`
- Modify: `lib/local-user-data.ts`
- Create: `providers/flashcards-provider.tsx`
- Modify: `app/_layout.tsx`
- Test: `tests/flashcards-provider.test.ts`

- [ ] Add owner-scoped storage key and provider actions for CRUD, filters, and reviews.
- [ ] Write failing tests for hydration, archive/delete behavior, idempotent saves, and review updates.
- [ ] Implement local persistence first; keep UI usable offline and isolate users.
- [ ] Expose due counts and session helpers through `useFlashcards`.

### Task 3: Supabase schema and synchronization

**Files:**
- Create: `supabase/migrations/20260828230000_flashcards.sql`
- Create: `lib/remote-flashcards.ts`
- Modify: `providers/flashcards-provider.tsx`
- Test: `tests/flashcards-schema.test.ts`

- [ ] Add decks, cards, and review history tables with ownership, timestamps, soft archive, indexes, constraints, and RLS.
- [ ] Write migration assertions for policies, grants, uniqueness, and cascade behavior.
- [ ] Add authenticated pull/push/upsert/delete helpers using only the public client key.
- [ ] Merge remote data idempotently without overwriting newer local edits or creating duplicate reviews.

### Task 4: Route, navigation, and UI

**Files:**
- Create: `app/flashcards.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `lib/app-feature-catalog.ts`
- Modify: `components/kad-drawer-content.tsx` only if required by route registration

- [ ] Write presentation tests for empty, loading, error, deck list, card editor, and review states.
- [ ] Build the Flashcards screen with summary, deck list, create/edit sheet, search/filter controls, and review session.
- [ ] Use purple for primary actions, turquoise for progress, and existing semantic colors for status.
- [ ] Ensure keyboard focus, screen-reader labels, 44px touch targets, reduced motion, light/dark themes, and responsive layouts.

### Task 5: Documentation, verification, and delivery

**Files:**
- Create: `docs/FLASHCARDS.md`
- Modify: `README.md` only if navigation/setup documentation requires it

- [ ] Document data model, scheduler, privacy/RLS, offline behavior, and local migration steps.
- [ ] Run `npm run check` and verify the app route in web/Expo with empty and populated states.
- [ ] Confirm no production database writes, secrets, packages, or logs enter Git.
- [ ] Commit, push the branch, and open a PR without merging.
