-- Migration 21 — rename `places` → `cities` everywhere in the schema.
--
-- The lore data model now reads as:
--     trips → cities → areas
--                    → venues
-- "Place" in the per-trip-row sense was always a city; the rename makes
-- that explicit and frees the word "place" for the canonical-aggregation
-- layer (which lives in `destinations` and is a separate refactor).
--
-- This migration does not touch data. Every existing place row keeps its
-- UUID and every foreign key keeps its target. Only names change.

-- Table -------------------------------------------------------------------

alter table public.places rename to cities;

-- FK columns on direct children -----------------------------------------

alter table public.venues rename column place_id to city_id;
alter table public.areas  rename column place_id to city_id;

-- list_items / wishlist_items: the brief's saved-place rows now point at
-- a city. (These are owned by Postmark migration 5; the FK still
-- references the same row, just under a new column name.)

alter table public.list_items     rename column place_id to city_id;
alter table public.wishlist_items rename column place_id to city_id;

-- trip_photos.place_id stays as a per-photo locator within the trip — it
-- pointed at places, so rename for consistency.

alter table public.trip_photos rename column place_id to city_id;

-- Enum values -----------------------------------------------------------
-- tip_parent: 'place' → 'city'
-- verdict_target: 'place' → 'city'
-- search_result_kind: 'place' → 'city' (+ 'country' added below)
--
-- ALTER TYPE ... RENAME VALUE updates the enum label in the catalog;
-- existing column rows reference the value by internal sortord, so they
-- continue to compare equal under the new label.

alter type public.tip_parent       rename value 'place' to 'city';
alter type public.verdict_target   rename value 'place' to 'city';
alter type public.search_result_kind rename value 'place' to 'city';
alter type public.search_result_kind add value if not exists 'country';

-- Indexes ---------------------------------------------------------------
-- Names that contained "places" become "cities" so DBAs aren't grep'ing
-- through stale identifiers. Indexes still cover the same columns.

alter index if exists places_trip_idx              rename to cities_trip_idx;
alter index if exists places_search_idx            rename to cities_search_idx;
alter index if exists places_user_google_place_uq  rename to cities_trip_google_place_uq;
alter index if exists places_google_place_idx      rename to cities_google_place_idx;

-- Check constraint on cities.hero_photo_source ----

alter table public.cities
  rename constraint places_hero_photo_source_values to cities_hero_photo_source_values;

-- RLS policies on cities (formerly places) -------
-- Postgres tracks policy expressions by OID, so the policy bodies that
-- reference public.places implicitly retarget to public.cities after
-- the rename. We rename the policy NAMES for readability only.

alter policy places_owner_all     on public.cities rename to cities_owner_all;
alter policy places_visible_read  on public.cities rename to cities_visible_read;

-- SQL function and view bodies that reference the old `places` table or
-- `place_id` column are rewritten in migration 24. They will break in
-- this intermediate state — DO NOT split this migration from 22 + 24
-- when deploying.
