-- Migration 15 — Session 1 (revised): place identity + curated photo layer.
--
-- Two pieces:
--   1. Adds structured place-identity columns to `places` so a place can
--      be resolved to a Google Place ID, typed, and given a hero photo
--      cached from one of curated / unsplash / google_places sources.
--   2. New `curated_destinations` table — a handpicked image library for
--      the destinations we've personally vetted. Looked up by Google
--      Place ID first, then by normalized name + country.
--
-- The user-uploaded photo flow (`trip_photos` + `trips.cover_photo_id`)
-- is unchanged and always takes precedence over the hero_photo_* columns
-- below — those are for the *resolved fallback* when the trip has no
-- user-uploaded cover yet.

-- 1. places identity + hero photo columns ---------------------------------

alter table public.places
  add column if not exists google_place_id text,
  add column if not exists place_types text[],
  add column if not exists hero_photo_source text,
  add column if not exists hero_photo_url text,
  add column if not exists hero_photo_credit text;

alter table public.places
  drop constraint if exists places_hero_photo_source_values;
alter table public.places
  add constraint places_hero_photo_source_values
  check (hero_photo_source is null
    or hero_photo_source in ('user', 'curated', 'unsplash', 'google_places'));

-- Place IDs are unique per trip so the same trip can't double-add the
-- same Google place.
create unique index if not exists places_user_google_place_uq
  on public.places (trip_id, google_place_id)
  where google_place_id is not null and deleted_at is null;

-- Aggregation index for cross-trip queries like "how many friends have
-- logged this Google place".
create index if not exists places_google_place_idx
  on public.places (google_place_id)
  where google_place_id is not null and deleted_at is null;

-- 2. curated_destinations ---------------------------------------------------

create table if not exists public.curated_destinations (
  id uuid primary key default gen_random_uuid(),
  google_place_id text,
  normalized_name text not null,
  country text,
  display_name text not null,
  photo_url text not null,
  photo_credit text,
  photographer_name text,
  photographer_url text,
  added_at timestamptz not null default now(),
  added_by_user_id uuid references public.users(id) on delete set null
);

-- Place-ID lookup is the primary path.
create unique index if not exists curated_dest_place_id_uq
  on public.curated_destinations (google_place_id)
  where google_place_id is not null;

-- Fallback: name + country (for free-text submissions or pre-Place-ID
-- entries). Postgres functional unique index — case-insensitive.
create unique index if not exists curated_dest_name_country_uq
  on public.curated_destinations (lower(normalized_name), coalesce(lower(country), ''));

create index if not exists curated_dest_name_idx
  on public.curated_destinations (lower(normalized_name));

alter table public.curated_destinations enable row level security;

-- Anyone authenticated reads. No client-side writes — inserts via
-- service-role through scripts/add-curated-destination.ts only.
create policy curated_dest_authenticated_read on public.curated_destinations
  for select to authenticated using (true);
