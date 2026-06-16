-- ============================================================================
-- Woord van de Dag — archive + image migration
-- Run this ONCE in the Supabase dashboard → SQL Editor.
-- It is idempotent: safe to run more than once.
-- ============================================================================

-- 1. The archive page (archive.html) reads from word_archive. It already has
--    word, date, pos, definition. Add the remaining columns the word + image
--    archive needs.
alter table public.word_archive add column if not exists etymology      text;
alter table public.word_archive add column if not exists example        text;
alter table public.word_archive add column if not exists source         text;
alter table public.word_archive add column if not exists in_de_praktijk jsonb;
alter table public.word_archive add column if not exists image_url      text;
alter table public.word_archive add column if not exists created_at      timestamptz default now();
alter table public.word_archive add column if not exists level          text;

-- 2. Case-insensitive, whitespace-trimmed uniqueness on the word. This makes the
--    duplicate check race-proof at the database level: a second insert of the
--    same word (any casing/spacing) fails instead of creating a duplicate row.
create unique index if not exists word_archive_word_lower_idx
  on public.word_archive (lower(btrim(word)));

-- 3. Row-level security: anyone may READ the archive (the public archive page and
--    the homepage manifest use the anon key); only the server's service-role key
--    may write (it bypasses RLS).
alter table public.word_archive enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'word_archive'
      and policyname = 'word_archive_public_read'
  ) then
    create policy word_archive_public_read
      on public.word_archive for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- ============================================================================
-- 4. Storage bucket for the generated word images.
--    The server also creates this bucket automatically on startup, so this
--    block is just a fallback / makes the bucket public read explicit.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('word-images', 'word-images', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'word_images_public_read'
  ) then
    create policy word_images_public_read
      on storage.objects for select
      to anon, authenticated
      using (bucket_id = 'word-images');
  end if;
end $$;
