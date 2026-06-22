-- Migration 37 — Vouched v2 foundation.
--
-- The product is re-anchored on the validated v2 PRD: "trusted trip notes,
-- written in a friend's voice, become more useful travel infrastructure
-- than generic reviews." Three locked decisions drive the schema:
--   - Trip is the INPUT unit  → trips.note is the original_note (source of truth)
--   - Tip is the SEARCHABLE unit → new log_tips table, extracted from the note
--   - Person is the RELEVANCE signal → follows gains accept-status + trust contexts
--
-- Deliberately NOT in this migration (v2 §12 deferrals):
--   - Canonical global Place. v2: "do not force every tip to a formal Place
--     record." log_tips.place_id is nullable; placeless tips (skip/ask_contact)
--     carry area_text/destination_text instead.
--   - Trust tiers (close/taste/follow). v2 cut these to "accept + per-person
--     context". follows.trust_contexts is an array, not a tier enum.
--   - taste_tags, price_level, best_for, would_go_again — all cut by v2.
--
-- The legacy polymorphic `tips` table (macro/atomic) is left untouched — it's
-- still read by trip detail + extracted-entities. log_tips is a new, cleaner
-- entity for the v2 extracted-tip model.

-- ---- TripLog: extend trips ------------------------------------------------
-- trips.note already serves as original_note (the source of truth). Add the
-- friend-framed composer fields + the one-tap verdict.

alter table public.trips
  add column if not exists verdict public.verdict_kind,
  add column if not exists destination_text text,
  add column if not exists destination_city text,
  add column if not exists destination_country text,
  add column if not exists audience_frame text,
  add column if not exists trip_context text,
  add column if not exists visited_month text; -- 'YYYY-MM' or free text; not a date (users say "last spring")

-- ---- TrustConnection: extend follows --------------------------------------
-- v2: request-and-accept (mutual visibility on acceptance) + per-person trust
-- contexts ("I trust Divyansh for outdoors"). Existing rows are grandfathered
-- to 'accepted' so the current one-way follow graph keeps working.

alter table public.follows
  add column if not exists status text not null default 'accepted',
  add column if not exists trust_contexts text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

alter table public.follows
  drop constraint if exists follows_status_check;
alter table public.follows
  add constraint follows_status_check
  check (status in ('pending', 'accepted', 'blocked'));

-- ---- log_tips: the v2 Tip (searchable unit) -------------------------------

create table if not exists public.log_tips (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  text text not null,                       -- preserves the friend's original wording
  advice_type text not null,
  place_id uuid,                            -- nullable: canonical Place deferred
  area_text text,
  destination_text text not null,           -- denormalized for search without a join
  extraction_status text not null default 'system_extracted',
  confidence double precision,
  visibility public.visibility not null default 'friends_of_friends',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint log_tips_advice_type_check check (
    advice_type in ('do','eat_drink','stay','book','ask_contact','shop','skip','avoid','area','other')
  ),
  constraint log_tips_extraction_status_check check (
    extraction_status in ('system_extracted','user_edited','user_created')
  )
);

create index if not exists log_tips_trip_idx on public.log_tips (trip_id) where deleted_at is null;
create index if not exists log_tips_user_idx on public.log_tips (user_id, created_at desc) where deleted_at is null;
create index if not exists log_tips_advice_idx on public.log_tips (advice_type) where deleted_at is null;
-- Lowercased-prefix index for destination matching. pg_trgm isn't enabled in
-- this project (search uses tsvector FTS), and at v0 scale a btree on the
-- normalized destination is plenty. The Loop-B ranking RPC owns the real
-- search strategy; this just keeps destination lookups off a seq scan.
create index if not exists log_tips_dest_idx on public.log_tips (lower(destination_text)) where deleted_at is null;

alter table public.log_tips enable row level security;

-- Owner can do anything with their own tips.
drop policy if exists log_tips_owner_all on public.log_tips;
create policy log_tips_owner_all on public.log_tips
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Circle read: a tip is visible if the viewer is allowed to see the author at
-- the tip's visibility level. Mirrors the cities/venues visibility pattern via
-- the existing is_visible_to(viewer, owner, visibility) helper.
drop policy if exists log_tips_circle_read on public.log_tips;
create policy log_tips_circle_read on public.log_tips
  for select
  using (
    deleted_at is null
    and (
      auth.uid() = user_id
      or public.is_visible_to(auth.uid(), user_id, visibility)
    )
  );

create trigger log_tips_set_updated_at
  before update on public.log_tips
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.log_tips to authenticated;

notify pgrst, 'reload schema';
