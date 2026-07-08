-- Migration 69 — note_reach(): the taste-era PAYOFF LOOP, counts-only.
--
-- The altruistic reward for writing a voiced note is learning it got USED —
-- someone opened the map to (or shared) a place you wrote about. Same thesis
-- as migration 50's get_vouch_uses() (the trust-era payoff), surfaced
-- PULL-only on the You tab per the no-push constitution.
--
-- Source signals: place_interactions (migration 68) rows of kind
-- 'maps_opened' / 'place_shared' by OTHER users, on places where the caller
-- has a live voiced note (vouches.text non-empty), counted only from the
-- note's created_at onward — an event that predates the note can't have been
-- influenced by it.
--
-- Why SECURITY DEFINER: place_interactions is own-select-only (a private
-- behavioral log), so the author can never see their payoff via a plain
-- query. Safe by construction: every returned row is gated on the CALLER
-- owning a live voiced note on that place, and — unlike get_vouch_uses,
-- where a save is a deliberate social act with an attributed saver — these
-- are passive signals, so this function returns AGGREGATE COUNTS ONLY.
-- No actor identities, no event timestamps beyond a max() for ordering.
--
-- Honesty note for the UI: an opens-count does not prove the actor read the
-- caller's note first (they may have arrived via Go Out ranking). Copy must
-- say "opened the map to places you've written about", never "because of
-- your note".

create or replace function public.note_reach()
returns table (
  place_id uuid,
  place_name text,
  maps_opens bigint,
  shares bigint,
  last_used_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pi.place_id,
    cp.name as place_name,
    count(*) filter (where pi.kind = 'maps_opened') as maps_opens,
    count(*) filter (where pi.kind = 'place_shared') as shares,
    max(pi.created_at) as last_used_at
  from public.place_interactions pi
  join public.canonical_places cp on cp.id = pi.place_id
  join public.users actor
    on actor.id = pi.user_id
   and actor.deleted_at is null
  where pi.user_id <> auth.uid()
    and pi.kind in ('maps_opened', 'place_shared')
    and exists (
      select 1
      from public.vouches v
      where v.user_id = auth.uid()
        and v.place_id = pi.place_id
        and v.deleted_at is null
        and v.text is not null
        and v.text <> ''
        and v.created_at <= pi.created_at
    )
  group by pi.place_id, cp.name
  order by max(pi.created_at) desc;
$$;

-- Grant hygiene per migration 63: definer functions are never PUBLIC/anon.
revoke execute on function public.note_reach() from public, anon;
grant execute on function public.note_reach() to authenticated;

notify pgrst, 'reload schema';
