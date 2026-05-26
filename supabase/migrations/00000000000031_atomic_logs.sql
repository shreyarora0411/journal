-- Migration 31 — atomic logs: venues become first-class log rows.
--
-- Until this migration `venues` were always children of a trip-bound
-- city. After this, a venue is a standalone log row with its own
-- user_id, category, one_line, prose, optional trip_id, and visibility.
-- The city above it can also be standalone (trip_id nullable, user_id
-- direct).
--
-- Additive only. The columns that already existed (name, quote, kind,
-- lat, lng, google_place_id, etc.) stay; venues that pre-date the
-- atomic-log surface keep working through their old reads.
--
-- Visibility model: each venue carries its own `visibility` (default
-- friends_of_friends). RLS reads against venues.user_id directly via
-- is_visible_to(), bypassing the older city→trip chain.

-- =========================================================================
-- 1. cities: direct user_id + nullable trip_id
-- =========================================================================

alter table public.cities
  add column if not exists user_id uuid references public.users(id) on delete cascade;

-- Backfill from the parent trip's user_id.
update public.cities c
set user_id = t.user_id
from public.trips t
where c.trip_id = t.id and c.user_id is null;

-- Allow trip_id null so cities can exist as standalone atomic-log parents.
alter table public.cities alter column trip_id drop not null;

create index if not exists cities_user_id_idx
  on public.cities (user_id) where deleted_at is null;

-- (NOT NULL on user_id is enforced in a follow-up migration once
-- legacy rows without parents are reviewed — keeps this migration safe
-- to re-run.)

-- =========================================================================
-- 2. areas: direct user_id (RLS for standalone area logs)
-- =========================================================================

alter table public.areas
  add column if not exists user_id uuid references public.users(id) on delete cascade;

update public.areas a
set user_id = c.user_id
from public.cities c
where a.city_id = c.id and a.user_id is null;

create index if not exists areas_user_id_idx
  on public.areas (user_id) where deleted_at is null;

-- =========================================================================
-- 3. venues: atomic-log columns
-- =========================================================================

alter table public.venues
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists category text,
  add column if not exists one_line text,
  add column if not exists prose text,
  add column if not exists trip_id uuid references public.trips(id) on delete set null,
  add column if not exists visibility public.visibility default 'friends_of_friends',
  add column if not exists google_place_id text;

-- Check constraints (drop-then-add to make this re-runnable).
alter table public.venues drop constraint if exists venues_category_values;
alter table public.venues
  add constraint venues_category_values
  check (category is null or category in ('stay', 'food', 'drinks', 'wander', 'buy'));

alter table public.venues drop constraint if exists venues_one_line_length;
alter table public.venues
  add constraint venues_one_line_length
  check (one_line is null or length(one_line) <= 280);

alter table public.venues drop constraint if exists venues_prose_length;
alter table public.venues
  add constraint venues_prose_length
  check (prose is null or length(prose) <= 10000);

-- Backfill venues.user_id from the parent city's user_id (legacy rows).
update public.venues v
set user_id = c.user_id
from public.cities c
where v.city_id = c.id and v.user_id is null;

-- Backfill venues.trip_id from the parent city's trip_id where the
-- venue was previously inferred to belong to that trip.
update public.venues v
set trip_id = c.trip_id
from public.cities c
where v.city_id = c.id and v.trip_id is null and c.trip_id is not null;

create index if not exists venues_user_id_idx
  on public.venues (user_id) where deleted_at is null;
create index if not exists venues_trip_id_idx
  on public.venues (trip_id) where deleted_at is null and trip_id is not null;
create index if not exists venues_category_idx
  on public.venues (category) where deleted_at is null and category is not null;
create index if not exists venues_google_place_idx
  on public.venues (google_place_id) where deleted_at is null and google_place_id is not null;

-- One venue per (user, google_place_id) so re-logging the same place is
-- an update, not a duplicate.
create unique index if not exists venues_user_google_place_uq
  on public.venues (user_id, google_place_id)
  where google_place_id is not null and deleted_at is null;

-- =========================================================================
-- 4. RLS: venues + areas + cities now gated by their own user_id
-- =========================================================================
-- Previous policies gated reads via the city→trip→user chain. With
-- venues now potentially standalone (no trip), we switch the visibility
-- read policy to check venue.user_id directly via is_visible_to.
-- Owner read-write policies stay unchanged where they only refer to
-- the row's user_id.

drop policy if exists venues_visible_read on public.venues;
create policy venues_visible_read on public.venues for select
  using (
    deleted_at is null
    and public.is_visible_to(
      auth.uid(),
      user_id,
      coalesce(visibility, 'friends_of_friends'::public.visibility)
    )
  );

drop policy if exists venues_owner_insert on public.venues;
create policy venues_owner_insert on public.venues for insert
  with check (auth.uid() = user_id);

drop policy if exists venues_owner_update on public.venues;
create policy venues_owner_update on public.venues for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists venues_owner_delete on public.venues;
create policy venues_owner_delete on public.venues for delete
  using (auth.uid() = user_id);

-- areas: owner-only writes, visibility-aware reads via parent city's
-- user_id (areas don't carry their own visibility column for now —
-- they inherit from the venue/city they're inside).
drop policy if exists areas_visible_read on public.areas;
create policy areas_visible_read on public.areas for select
  using (
    deleted_at is null
    and (
      auth.uid() = user_id
      or exists (
        select 1 from public.cities c
        where c.id = city_id
          and c.deleted_at is null
          and public.is_visible_to(
            auth.uid(),
            c.user_id,
            'friends_of_friends'::public.visibility
          )
      )
    )
  );

-- cities visibility read: own + via parent trip if any + friends_of_friends
-- of the city's direct user_id when standalone.
drop policy if exists cities_visible_read on public.cities;
create policy cities_visible_read on public.cities for select
  using (
    deleted_at is null
    and (
      auth.uid() = user_id
      or (
        trip_id is not null and exists (
          select 1 from public.trips t
          where t.id = trip_id and t.deleted_at is null
            and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
        )
      )
      or (
        trip_id is null and user_id is not null and public.is_visible_to(
          auth.uid(),
          user_id,
          'friends_of_friends'::public.visibility
        )
      )
    )
  );
