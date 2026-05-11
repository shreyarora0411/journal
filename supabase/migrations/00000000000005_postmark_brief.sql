-- Postmark brief migration. Additive over what's already shipped.
-- New: destinations, lists, list_items, wishlist_items, activity.
-- Extends users with bio, favourite_four_trip_ids, is_creator, photo_url alias.
-- Place-as-first-class is achieved without restructuring `places` — we use a
-- canonical view that groups places by (normalized name, country) so a "place"
-- in the brief sense can aggregate multiple per-trip rows.

-- ===========================================================================
-- Users extensions
-- ===========================================================================

alter table public.users
  add column if not exists bio text,
  add column if not exists favourite_four_trip_ids uuid[] not null default array[]::uuid[],
  add column if not exists is_creator boolean not null default false;

-- ===========================================================================
-- Destinations
-- ===========================================================================
-- City/region-level. Trips reference these for grouping. For pilot we
-- pre-seed nothing; new destinations are created on demand.

create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- 'Lisbon'
  country text,                  -- 'Portugal'
  region text,                   -- 'Europe' — coarse for grouping
  search_vec tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(country, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(region, '')), 'C')
  ) stored,
  created_at timestamptz not null default now()
);

create unique index if not exists destinations_name_country_uq
  on public.destinations (lower(name), coalesce(lower(country), ''));
create index if not exists destinations_search_idx on public.destinations using gin (search_vec);

alter table public.destinations enable row level security;

-- Destinations are global, readable by any authenticated user.
create policy destinations_authenticated_read on public.destinations
  for select to authenticated using (true);
create policy destinations_authenticated_insert on public.destinations
  for insert to authenticated with check (true);

-- Optional FK from trips to destinations. Backfill is application-level.
alter table public.trips
  add column if not exists destination_id uuid references public.destinations (id) on delete set null;
create index if not exists trips_destination_idx on public.trips (destination_id);

-- ===========================================================================
-- Lists
-- ===========================================================================

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  description text,
  visibility public.visibility not null default 'friends_of_friends',
  cover_color text,              -- one of the photo-palette hex stops, picked client-side
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists lists_owner_idx on public.lists (owner_id, created_at desc) where deleted_at is null;

alter table public.lists enable row level security;

create policy lists_owner_all on public.lists for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy lists_visible_read on public.lists for select
  using (
    deleted_at is null
    and public.is_visible_to(auth.uid(), owner_id, visibility)
  );

create trigger lists_set_updated_at
  before update on public.lists
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  destination_id uuid references public.destinations (id) on delete set null,
  place_id uuid references public.places (id) on delete set null,
  note text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  -- One of destination_id or place_id must be set.
  check (destination_id is not null or place_id is not null)
);

create index if not exists list_items_list_idx on public.list_items (list_id, order_index);

alter table public.list_items enable row level security;

-- A list_item is visible iff its parent list is. We piggyback through the same logic.
create policy list_items_owner_all on public.list_items for all
  using (
    exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid())
  );
create policy list_items_visible_read on public.list_items for select
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_id
        and l.deleted_at is null
        and public.is_visible_to(auth.uid(), l.owner_id, l.visibility)
    )
  );

-- ===========================================================================
-- Wishlist
-- ===========================================================================
-- "Save place to my next trip" — a viewer-owned save with attribution to
-- whoever's note inspired the save (saved_from_user_id / saved_from_trip_id).

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  place_id uuid references public.places (id) on delete set null,
  destination_id uuid references public.destinations (id) on delete set null,
  saved_from_trip_id uuid references public.trips (id) on delete set null,
  saved_from_user_id uuid references public.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  check (place_id is not null or destination_id is not null)
);

create index if not exists wishlist_user_idx on public.wishlist_items (user_id, created_at desc);

alter table public.wishlist_items enable row level security;

create policy wishlist_owner_all on public.wishlist_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===========================================================================
-- Activity stream
-- ===========================================================================
-- Append-only. Aggregated client-side into Today / Yesterday / This week.

create type public.activity_type as enum (
  'trip_added',
  'place_added',
  'place_saved',
  'list_created',
  'list_followed',
  'asked_about',
  'follow_started'
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type public.activity_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_user_idx on public.activity (user_id, created_at desc);
create index if not exists activity_recent_idx on public.activity (created_at desc);

alter table public.activity enable row level security;

-- A row is visible if you authored it OR you follow the author.
create policy activity_owner_select on public.activity for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.follows
      where follower_id = auth.uid() and followed_id = user_id
    )
  );
create policy activity_owner_insert on public.activity for insert
  with check (auth.uid() = user_id);

-- ===========================================================================
-- Place aggregation view (place-as-first-class for the pilot)
-- ===========================================================================
-- Groups places with the same lowercased name within the same trip's
-- destination/country into a single "canonical" key. Lets the place detail
-- page show all friends who've saved the same place across different trips
-- without restructuring the underlying tables.

create or replace view public.canonical_places as
  select
    lower(p.name) || '|' || coalesce(lower(p.country), '') as canonical_key,
    lower(p.name) as canonical_name,
    -- Pick any display variant (first by created_at) — names vary slightly.
    (array_agg(p.name order by p.created_at))[1] as display_name,
    p.country as country,
    array_agg(distinct p.id) as place_ids,
    array_agg(distinct t.id) as trip_ids,
    array_agg(distinct t.user_id) as user_ids,
    count(distinct t.user_id) as saved_by_count,
    min(p.created_at) as first_seen_at,
    max(p.created_at) as last_seen_at
  from public.places p
  join public.trips t on t.id = p.trip_id
  where p.deleted_at is null and t.deleted_at is null
  group by lower(p.name), p.country;
