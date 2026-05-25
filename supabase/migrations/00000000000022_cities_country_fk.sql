-- Migration 22 — cities.country_id (FK to countries) + backfill.
--
-- Step 1: drop the generated search_vec column (it references the
--         soon-to-be-dropped `country` text column).
-- Step 2: add country_id FK.
-- Step 3: backfill country_id from the existing `country` text column.
-- Step 4: recreate search_vec without the country text (country names
--         become searchable at the country level via the new union arm
--         in search_friend_graph — see migration 24).
--
-- The `country` text column is NOT dropped in this migration. Migration
-- 23 drops it after a hard guard against incomplete backfill.

-- 1. Drop search_vec + its GIN index (will be recreated). -----------------

drop index if exists cities_search_idx;
alter table public.cities drop column if exists search_vec;

-- 2. Add country_id FK. ---------------------------------------------------

alter table public.cities
  add column if not exists country_id uuid references public.countries(id);

create index if not exists cities_country_idx
  on public.cities (country_id) where country_id is not null;

-- 3. Backfill -------------------------------------------------------------
-- Match by lowercased display_name first (covers "Japan", "India", etc).

update public.cities c
set country_id = co.id
from public.countries co
where lower(trim(c.country)) = lower(co.display_name)
  and c.country_id is null
  and c.country is not null
  and c.country <> '';

-- Common variants for the big multi-name countries.
update public.cities c
set country_id = (select id from public.countries where iso_alpha2 = 'GB')
where c.country_id is null
  and lower(trim(c.country)) in (
    'uk', 'u.k.', 'britain', 'great britain', 'england', 'scotland', 'wales'
  );

update public.cities c
set country_id = (select id from public.countries where iso_alpha2 = 'US')
where c.country_id is null
  and lower(trim(c.country)) in (
    'usa', 'u.s.a.', 'u.s.', 'america', 'united states of america'
  );

update public.cities c
set country_id = (select id from public.countries where iso_alpha2 = 'AE')
where c.country_id is null
  and lower(trim(c.country)) in ('uae', 'u.a.e.', 'emirates');

-- ISO alpha-2 short-codes (in case Google Places shortText leaked in).
update public.cities c
set country_id = co.id
from public.countries co
where c.country_id is null
  and upper(trim(c.country)) = co.iso_alpha2
  and length(trim(c.country)) = 2;

-- After running this migration the operator should diagnose unmatched
-- rows:
--   select distinct country, count(*) from public.cities
--   where country_id is null and country is not null and country <> ''
--   group by country order by count desc;
-- For each remaining group: either add the country to public.countries
-- and re-run the lowercased-display_name UPDATE, or fix the cities row
-- by hand. Migration 23 will refuse to run until this is clean.

-- 4. Recreate search_vec without country text. ---------------------------
-- Country becomes a separate top-level search target in migration 24.

alter table public.cities
  add column search_vec tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(region, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(note, '')), 'C')
  ) stored;

create index cities_search_idx on public.cities using gin (search_vec);
