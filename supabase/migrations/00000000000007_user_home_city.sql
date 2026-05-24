-- Slice 3 — location-first trip clustering (ADR 0009).
-- Adds the user's home city + coords + country code, captured manually in
-- the Framing onboarding step. Used to classify camera-roll clusters as
-- TRIP / drop based on distance-from-home and cross-country signals.
-- All four columns are nullable; existing users get NULL and are prompted
-- on next profile save.

alter table public.users
  add column if not exists home_city text,
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision,
  add column if not exists home_country_code text;

-- ISO 3166-1 alpha-2 — keep the column tight so we can index/filter on it.
alter table public.users
  add constraint users_home_country_code_format
  check (home_country_code is null or home_country_code ~ '^[A-Z]{2}$');
