-- Migration 38 — pivot to the no-LLM vouch model (v3 PRD).
--
-- v3 removes the extraction step entirely. Vouches arrive already atomic and
-- already typed because the user wrote each one into a category slot
-- (stay / eat_drink / do / good_to_know / skip) in the composer. No model
-- guesses type or wording; the user did, by choosing the slot.
--
-- Migration 37 created log_tips for the extraction-era model (10 advice_types,
-- confidence, extraction_status). It has no production rows, so we drop it and
-- create `vouches` fresh with the v3 shape rather than a chain of alters. The
-- trips/follows changes from migration 37 stay — they're still correct for v3.

drop table if exists public.log_tips cascade;

create table if not exists public.vouches (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  text text not null,                       -- the user's own voiced wording, verbatim
  vouch_type text not null,                 -- the composer category the user chose
  place_id uuid,                            -- nullable: light place resolution, never blocks a save
  area_text text,
  destination_text text not null,           -- denormalized for search without a join
  source text not null default 'user_created', -- always user_created in v0 (no extraction)
  visibility public.visibility not null default 'friends_of_friends',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vouches_vouch_type_check check (
    vouch_type in ('stay','eat_drink','do','good_to_know','skip')
  ),
  constraint vouches_source_check check (source in ('user_created'))
);

create index if not exists vouches_trip_idx on public.vouches (trip_id) where deleted_at is null;
create index if not exists vouches_user_idx on public.vouches (user_id, created_at desc) where deleted_at is null;
create index if not exists vouches_type_idx on public.vouches (vouch_type) where deleted_at is null;
create index if not exists vouches_dest_idx on public.vouches (lower(destination_text)) where deleted_at is null;

alter table public.vouches enable row level security;

drop policy if exists vouches_owner_all on public.vouches;
create policy vouches_owner_all on public.vouches
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Circle read: visible if the viewer may see the author at the vouch's
-- visibility level. Mirrors the cities/venues pattern via is_visible_to().
drop policy if exists vouches_circle_read on public.vouches;
create policy vouches_circle_read on public.vouches
  for select
  using (
    deleted_at is null
    and (
      auth.uid() = user_id
      or public.is_visible_to(auth.uid(), user_id, visibility)
    )
  );

drop trigger if exists vouches_set_updated_at on public.vouches;
create trigger vouches_set_updated_at
  before update on public.vouches
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.vouches to authenticated;

notify pgrst, 'reload schema';
