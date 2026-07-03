-- Migration 59 — person map: another user's LOVED places (spec §3 screen 4's
-- missing structural affordance: tap a person → their MAP, not a profile).
--
-- Privacy model (consistent with mig 55/57):
--   * LOVED only — fine/skip never appear, for anyone, ever.
--   * Attribution of loves is the product surface (as in recommend_places).
--   * Notes re-apply is_visible_to() — the definer never bypasses vouch RLS.
--   * Blocked pairs (either direction) see nothing.
--   * NO timestamps exposed (timing correlates with private behavior);
--     ordering is alphabetical — stable and leak-free.
--   * p_user = viewer is allowed (your own map; harmless, mirrors Your Map).

create or replace function public.user_loved_places(p_user uuid)
returns table (
  place_id uuid,
  name text,
  hub text,
  zone text,
  category text,
  google_place_id text,
  lat double precision,
  lng double precision,
  note text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null or p_user is null then return; end if;
  if public.is_blocked_pair(v_viewer, p_user) then return; end if;

  return query
  select cp.id, cp.name, cp.hub, cp.zone, cp.category, cp.google_place_id,
         cp.lat, cp.lng,
         (
           select vch.text from public.vouches vch
           where vch.user_id = p_user and vch.place_id = cp.id
             and vch.deleted_at is null
             and (vch.user_id = v_viewer
                  or public.is_visible_to(v_viewer, vch.user_id, vch.visibility))
           order by vch.created_at desc limit 1
         ) as note
  from public.place_reactions r
  join public.canonical_places cp on cp.id = r.place_id
  where r.user_id = p_user
    and r.sentiment = 'loved'
  order by cp.name asc
  limit 100;
end;
$$;

revoke execute on function public.user_loved_places(uuid) from public, anon;
grant execute on function public.user_loved_places(uuid) to authenticated;

notify pgrst, 'reload schema';
