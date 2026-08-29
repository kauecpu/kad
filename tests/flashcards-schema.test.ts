import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = decodeURIComponent(new URL('../supabase/migrations/20260828230000_flashcards.sql', import.meta.url).pathname).replace(/^\/(\w):/, '$1:');
const migration = readFileSync(migrationPath, 'utf8');

test('migration de flashcards mantém dados privados e vínculos íntegros', () => {
  assert.match(migration, /create table if not exists public\.flashcard_decks/);
  assert.match(migration, /create table if not exists public\.flashcards/);
  assert.match(migration, /create table if not exists public\.flashcard_reviews/);
  assert.match(migration, /references public\.flashcard_decks \(id\) on delete cascade/);
  assert.match(migration, /alter table public\.flashcard_decks enable row level security/);
  assert.match(migration, /select auth\.uid\(\)\) = user_id/);
  assert.match(migration, /grant select, insert, update, delete on public\.flashcards to authenticated/);
  assert.doesNotMatch(migration, /service_role|anon\s+with\s+check/);
});

