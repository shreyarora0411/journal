-- Migration 52 — canonical places. A vouch is a friend's voiced rec, but until
-- now it pointed at no REAL place: "Open in Maps" had to guess from a lead
-- phrase, and per-venue consensus was impossible. This introduces a canonical
-- venue keyed by google_place_id (with lat/lng for a precise pin), wires the
-- long-reserved vouches.place_id column to it, and adds the definer RPC that
-- background place-resolution calls after a save.
--
-- Sacred constraint: resolution is a BACKGROUND step. Nothing here blocks the
-- composer fast door — there is no picker, no required field; place_id stays
-- nullable and a vouch is fully valid without one.
--
-- Places are non-secret reference data: SELECT is open to any authenticated
-- user. There is NO direct insert/update grant — the only write path is
-- resolve_vouch_place (SECURITY DEFINER), so a client can neither forge a place
-- nor poison an existing one (on-conflict only bumps updated_at).

create table if not exists public.canonical_places (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique not null,
  name text not null,
  destination_text text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.canonical_places enable row level security;

-- Places are non-secret reference data — readable by any authenticated user.
drop policy if exists "canonical_places_select_authenticated" on public.canonical_places;
create policy "canonical_places_select_authenticated"
  on public.canonical_places
  for select
  to authenticated
  using (true);

-- No insert/update/delete policies: the only write path is the definer RPC.
grant select on public.canonical_places to authenticated;

-- Wire the reserved vouches.place_id column to canonical_places. Guarded so a
-- re-run (or an environment where the FK already exists) is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vouches_place_id_fkey'
  ) then
    alter table public.vouches
      add constraint vouches_place_id_fkey
      foreign key (place_id)
      references public.canonical_places(id)
      on delete set null;
  end if;
end $$;

-- Lookup path for live (non-deleted), already-resolved vouches.
create index if not exists vouches_place_id_idx
  on public.vouches(place_id)
  where deleted_at is null and place_id is not null;

-- resolve_vouch_place — the single write path. Called in the background after a
-- save: upsert the canonical place by google_place_id, then (owner-only) point
-- the vouch at it. SECURITY DEFINER so it can write canonical_places despite no
-- direct grant; search_path pinned to public to keep the definer safe.
--   - ON CONFLICT only bumps updated_at — it deliberately does NOT overwrite
--     name/lat/lng, so one client cannot mutate a place another client created.
--   - The vouches UPDATE is gated on user_id = auth.uid(): a caller can only
--     attach a place to their OWN vouch.
create or replace function public.resolve_vouch_place(
  p_vouch_id uuid,
  p_google_place_id text,
  p_name text,
  p_destination text,
  p_lat double precision,
  p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place_id uuid;
begin
  insert into public.canonical_places as cp
    (google_place_id, name, destination_text, lat, lng)
  values
    (p_google_place_id, p_name, p_destination, p_lat, p_lng)
  on conflict (google_place_id) do update
    set updated_at = now()
  returning cp.id into v_place_id;

  update public.vouches
    set place_id = v_place_id
  where id = p_vouch_id
    and user_id = auth.uid();

  return v_place_id;
end;
$$;

grant execute on function public.resolve_vouch_place(
  uuid, text, text, text, double precision, double precision
) to authenticated;

notify pgrst, 'reload schema';
