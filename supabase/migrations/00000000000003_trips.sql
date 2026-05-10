-- Phase 2.1: trips and child entities (places, venues, areas, tips, photos).
-- Plus extraction_runs and extracted_entities for staged extraction output.
--
-- RLS for Phase 2 is owner-only on every table. Phase 3 will widen reads
-- based on per-trip visibility (followers / friends_of_friends / everyone).

-- Enums --------------------------------------------------------------------

create type public.venue_kind as enum (
  'stay', 'restaurant', 'cafe', 'nightlife', 'other'
);

create type public.tip_parent as enum ('trip', 'place');

create type public.tip_kind as enum ('macro', 'atomic');

create type public.entity_kind as enum ('venue', 'area', 'tip');

create type public.imported_from as enum ('instagram');

-- Trips --------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  start_date date,
  end_date date,
  note text,
  cover_photo_id uuid,
  visibility public.visibility not null default 'friends_of_friends',
  imported_from public.imported_from,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index trips_user_idx on public.trips (user_id, created_at desc) where deleted_at is null;

alter table public.trips enable row level security;

create policy trips_owner_all on public.trips for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- Places -------------------------------------------------------------------

create table public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  region text,
  country text,
  lat double precision,
  lng double precision,
  note text,
  arrival_date date,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index places_trip_idx on public.places (trip_id, position) where deleted_at is null;

alter table public.places enable row level security;

-- Owner of the parent trip can do anything.
create policy places_owner_all on public.places for all
  using (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );

create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

-- Areas (neighbourhoods inside a place) ------------------------------------

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  name text not null,
  quote text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index areas_place_idx on public.areas (place_id) where deleted_at is null;

alter table public.areas enable row level security;

create policy areas_owner_all on public.areas for all
  using (
    exists (
      select 1 from public.places p join public.trips t on t.id = p.trip_id
      where p.id = place_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.places p join public.trips t on t.id = p.trip_id
      where p.id = place_id and t.user_id = auth.uid()
    )
  );

create trigger areas_set_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

-- Venues (stays, restaurants, cafés, nightlife) ----------------------------

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  area_id uuid references public.areas (id) on delete set null,
  name text not null,
  kind public.venue_kind not null,
  quote text,
  lat double precision,
  lng double precision,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index venues_place_idx on public.venues (place_id, kind) where deleted_at is null;

alter table public.venues enable row level security;

create policy venues_owner_all on public.venues for all
  using (
    exists (
      select 1 from public.places p join public.trips t on t.id = p.trip_id
      where p.id = place_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.places p join public.trips t on t.id = p.trip_id
      where p.id = place_id and t.user_id = auth.uid()
    )
  );

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

-- Tips (polymorphic — child of trip OR place) ------------------------------

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  parent_type public.tip_parent not null,
  parent_id uuid not null,
  body text not null,
  kind public.tip_kind not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tips_parent_idx on public.tips (parent_type, parent_id) where deleted_at is null;

alter table public.tips enable row level security;

-- Polymorphic ownership check via subquery on whichever parent table.
create policy tips_owner_all on public.tips for all
  using (
    case parent_type
      when 'trip' then exists (
        select 1 from public.trips t where t.id = parent_id and t.user_id = auth.uid()
      )
      when 'place' then exists (
        select 1 from public.places p join public.trips t on t.id = p.trip_id
        where p.id = parent_id and t.user_id = auth.uid()
      )
    end
  )
  with check (
    case parent_type
      when 'trip' then exists (
        select 1 from public.trips t where t.id = parent_id and t.user_id = auth.uid()
      )
      when 'place' then exists (
        select 1 from public.places p join public.trips t on t.id = p.trip_id
        where p.id = parent_id and t.user_id = auth.uid()
      )
    end
  );

create trigger tips_set_updated_at
  before update on public.tips
  for each row execute function public.set_updated_at();

-- Trip photos --------------------------------------------------------------

create table public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id uuid references public.places (id) on delete set null,
  storage_path text not null,
  width int,
  height int,
  taken_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index trip_photos_trip_idx on public.trip_photos (trip_id, position) where deleted_at is null;

alter table public.trip_photos enable row level security;

create policy trip_photos_owner_all on public.trip_photos for all
  using (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );

-- Late-bind cover_photo_id FK now that trip_photos exists.
alter table public.trips
  add constraint trips_cover_photo_fk
  foreign key (cover_photo_id) references public.trip_photos (id) on delete set null;

-- Extraction tables --------------------------------------------------------

create table public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  model text not null,
  prompt_version text not null,
  input_text text not null,
  raw_output jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index extraction_runs_trip_idx on public.extraction_runs (trip_id, created_at desc);

alter table public.extraction_runs enable row level security;

create policy extraction_runs_owner_select on public.extraction_runs for select
  using (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );

-- Inserts come from the edge function (service role); no client policy needed.

create table public.extracted_entities (
  id uuid primary key default gen_random_uuid(),
  extraction_run_id uuid not null references public.extraction_runs (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind public.entity_kind not null,
  proposed_name text not null,
  proposed_quote text,
  proposed_metadata jsonb not null default '{}'::jsonb,
  confirmed boolean not null default false,
  rejected boolean not null default false,
  confirmed_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index extracted_entities_trip_idx on public.extracted_entities (trip_id, confirmed, rejected);

alter table public.extracted_entities enable row level security;

create policy extracted_entities_owner_all on public.extracted_entities for all
  using (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );

create trigger extracted_entities_set_updated_at
  before update on public.extracted_entities
  for each row execute function public.set_updated_at();

-- Storage bucket for trip photos -------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-photos',
  'trip-photos',
  false,
  20 * 1024 * 1024,  -- 20 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Storage RLS: users can read/write objects under their own user-id prefix.
-- Path convention: <user_id>/<trip_id>/<photo_id>.<ext>
create policy "trip_photos_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'trip-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "trip_photos_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'trip-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "trip_photos_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'trip-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "trip_photos_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'trip-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
