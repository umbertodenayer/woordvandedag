-- ─────────────────────────────────────────────────────────────────────────────
-- Community sentences for "Woord van de Dag".
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Each row is one user-written sentence tied to a specific day's word for a
-- specific level, so every word shows only its own sentences.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.sentences (
  id           uuid        primary key default gen_random_uuid(),
  word         text        not null,                 -- the word the sentence is for
  word_date    date        not null,                 -- Amsterdam day of that word
  level        text        not null,                 -- CEFR level (A1..C1, Native)
  user_id      uuid        not null references auth.users (id) on delete cascade,
  display_name text        not null,                 -- author's name (set server-side)
  text         text        not null,                 -- the sentence itself
  created_at   timestamptz not null default now()
);

-- One "word" == (word_date, level); feed is newest-first.
create index if not exists sentences_feed_idx
  on public.sentences (word_date, level, created_at desc);

alter table public.sentences enable row level security;

-- Anyone (including logged-out visitors) can read the feed.
drop policy if exists "sentences_select_all" on public.sentences;
create policy "sentences_select_all"
  on public.sentences for select
  using (true);

-- Only authenticated users may insert, and only rows owned by themselves.
-- (The server inserts with the service role and sets display_name from the
--  verified profile, so names can't be spoofed; this policy is the guard for
--  any direct client insert.)
drop policy if exists "sentences_insert_own" on public.sentences;
create policy "sentences_insert_own"
  on public.sentences for insert
  to authenticated
  with check (auth.uid() = user_id);
