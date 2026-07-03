-- Migration 57 — taste-era surface RPCs (docs/taste-pivot-spec.md §3).
--
-- Three definer functions the five screens sit on, inheriting migration 55's
-- privacy model: loves are attributed (the product surface), fine/skip never
-- leave own rows, blocked pairs are suppressed, vouch notes re-apply
-- is_visible_to(), cross-user match is loves-only + confidence-gated.

-- ---------------------------------------------------------------------------
-- 1. find_or_create_place — the Log screen's place-first door. canonical_places
--    deliberately has NO client write path (mig 52); this is the second
--    sanctioned definer path (place-first logging needs a place BEFORE any
--    vouch exists, so resolve_vouch_place can't serve it).
--    Founder-seeded category/hub/zone win: client values only fill NULLs, so a
--    client can never repaint a curated place.
-- ---------------------------------------------------------------------------

create or replace function public.find_or_create_place(
  p_google_place_id text,
  p_name text,
  p_destination_text text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_category text default null,
  p_hub text default null,
  p_zone text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if coalesce(trim(p_google_place_id), '') = '' or coalesce(trim(p_name), '') = '' then
    raise exception 'google_place_id and name are required';
  end if;
  -- Category must be a known prior key (or null) so a typo can't create an
  -- unpriorable place.
  if p_category is not null and not exists (
    select 1 from public.category_priors c where c.category = p_category
  ) then
    raise exception 'unknown category %', p_category;
  end if;

  insert into public.canonical_places
    (google_place_id, name, destination_text, lat, lng, category, hub, zone)
  values
    (trim(p_google_place_id), left(trim(p_name), 200), nullif(trim(coalesce(p_destination_text, '')), ''),
     p_lat, p_lng, p_category, nullif(trim(coalesce(p_hub, '')), ''), nullif(trim(coalesce(p_zone, '')), ''))
  on conflict (google_place_id) do update set
    name = excluded.name,
    lat = coalesce(public.canonical_places.lat, excluded.lat),
    lng = coalesce(public.canonical_places.lng, excluded.lng),
    destination_text = coalesce(public.canonical_places.destination_text, excluded.destination_text),
    -- Curated fields: existing (founder-seeded) values always win.
    category = coalesce(public.canonical_places.category, excluded.category),
    hub = coalesce(public.canonical_places.hub, excluded.hub),
    zone = coalesce(public.canonical_places.zone, excluded.zone),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. taste_twins — the People screen. Users ordered by taste-match to the
--    viewer. Honest: returns NOTHING until the viewer passes the confidence
--    gate (8 loves) — the client shows the "log more places" prompt instead
--    of fabricating matches. Followed people surface too (they're the circle).
-- ---------------------------------------------------------------------------

create or replace function public.taste_twins(p_limit int default 20)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  avatar_url text,
  match double precision,
  followed boolean,
  love_count int
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null then return; end if;
  -- Below the gate the match is undefined — return empty, never fabricate.
  if public.user_love_count(v_viewer) < 8 then return; end if;

  return query
  with candidates as (
    select u.id, u.display_name, u.handle, u.avatar_url
    from public.users u
    where u.id <> v_viewer
      and u.deleted_at is null
      and not public.is_blocked_pair(v_viewer, u.id)
      and public.user_love_count(u.id) >= 8
  )
  select c.id, c.display_name, c.handle, c.avatar_url,
         public.taste_match(c.id) as match,
         exists (
           select 1 from public.follows f
           where f.follower_id = v_viewer and f.followed_id = c.id
             and f.status = 'accepted'
         ) as followed,
         public.user_love_count(c.id) as love_count
  from candidates c
  where public.taste_match(c.id) is not null
  order by public.taste_match(c.id) desc
  limit p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. place_lovers — the Place page. Who in the graph loved this place
--    (attributed by design), match-annotated, notes visibility-gated. No
--    timestamps exposed (timing correlates with private behavior); ordering
--    is by match/follow weight only.
-- ---------------------------------------------------------------------------

create or replace function public.place_lovers(p_place uuid)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  avatar_url text,
  match double precision,
  followed boolean,
  note text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null or p_place is null then return; end if;

  return query
  select u.id, u.display_name, u.handle, u.avatar_url,
         public.taste_match(u.id) as match,
         exists (
           select 1 from public.follows f
           where f.follower_id = v_viewer and f.followed_id = u.id
             and f.status = 'accepted'
         ) as followed,
         (
           select vch.text from public.vouches vch
           where vch.user_id = u.id and vch.place_id = p_place
             and vch.deleted_at is null
             and public.is_visible_to(v_viewer, vch.user_id, vch.visibility)
           order by vch.created_at desc limit 1
         ) as note
  from public.place_reactions r
  join public.users u on u.id = r.user_id
  where r.place_id = p_place
    and r.sentiment = 'loved'
    and r.user_id <> v_viewer
    and u.deleted_at is null
    and not public.is_blocked_pair(v_viewer, r.user_id)
  order by public.taste_match(u.id) desc nulls last
  limit 20;
end;
$$;

-- Grants (replace only via create-or-replace — see mig 55 §10 note).
revoke execute on function public.find_or_create_place(text, text, text, double precision, double precision, text, text, text) from public, anon;
revoke execute on function public.taste_twins(int) from public, anon;
revoke execute on function public.place_lovers(uuid) from public, anon;
grant execute on function public.find_or_create_place(text, text, text, double precision, double precision, text, text, text) to authenticated;
grant execute on function public.taste_twins(int) to authenticated;
grant execute on function public.place_lovers(uuid) to authenticated;

notify pgrst, 'reload schema';
