begin;

create table if not exists public.flashcard_decks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  color text,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.flashcards (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id text not null references public.flashcard_decks (id) on delete cascade,
  front text not null check (char_length(trim(front)) between 1 and 10000),
  back text not null check (char_length(trim(back)) between 1 and 10000),
  tags text[] not null default '{}',
  state text not null default 'new' check (state in ('new', 'learning', 'review', 'suspended')),
  repetitions integer not null default 0 check (repetitions >= 0),
  interval_days numeric not null default 0 check (interval_days >= 0),
  ease_factor numeric not null default 2.5 check (ease_factor between 1.3 and 4.0),
  due_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id)
);

create table if not exists public.flashcard_reviews (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null references public.flashcards (id) on delete cascade,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null,
  previous_due_at timestamptz not null,
  next_due_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id)
);

create index if not exists flashcard_decks_user_idx on public.flashcard_decks (user_id, updated_at desc);
create index if not exists flashcards_user_due_idx on public.flashcards (user_id, due_at) where archived_at is null;
create index if not exists flashcards_deck_idx on public.flashcards (deck_id, updated_at desc);
create index if not exists flashcard_reviews_card_idx on public.flashcard_reviews (card_id, reviewed_at desc);

alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;

drop policy if exists "flashcard_decks_own" on public.flashcard_decks;
create policy "flashcard_decks_own" on public.flashcard_decks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "flashcards_own" on public.flashcards;
create policy "flashcards_own" on public.flashcards
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.flashcard_decks deck
      where deck.id = deck_id and deck.user_id = (select auth.uid())
    )
  );

drop policy if exists "flashcard_reviews_own" on public.flashcard_reviews;
create policy "flashcard_reviews_own" on public.flashcard_reviews
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.flashcards card
      where card.id = card_id and card.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.flashcard_decks to authenticated;
grant select, insert, update, delete on public.flashcards to authenticated;
grant select, insert on public.flashcard_reviews to authenticated;

commit;
