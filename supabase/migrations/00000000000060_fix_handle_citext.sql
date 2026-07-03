-- Migration 60 — fix 42804 in taste_twins/place_lovers: users.handle is
-- citext, but both functions declare `handle text` in RETURNS TABLE. plpgsql
-- RETURN QUERY type-checks strictly at runtime, so every call that reached the
-- row-returning query failed (place_lovers on any place page; taste_twins the
-- moment a viewer passes the 8-love gate). Cast at the select site — the
-- function contract stays text, which is what the client types expect.
--
-- recommend_places (mig 55) is unaffected: its handle goes through
-- jsonb_build_object, which serializes citext without a coercion check.
--
-- Replaced via create-or-replace ONLY (mig 55 §10 note: drop would recreate
-- default grants); revoke/grant re-asserted below regardless.

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
    select u.id, u.display_name, u.handle::text as handle, u.avatar_url
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
  select u.id, u.display_name, u.handle::text, u.avatar_url,
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

revoke execute on function public.taste_twins(int) from public, anon;
revoke execute on function public.place_lovers(uuid) from public, anon;
grant execute on function public.taste_twins(int) to authenticated;
grant execute on function public.place_lovers(uuid) to authenticated;

notify pgrst, 'reload schema';
