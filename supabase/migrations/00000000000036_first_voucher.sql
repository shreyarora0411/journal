-- Migration 36 — `get_first_voucher_for_place` RPC.
--
-- Round 2 (validator-thesis): on a trip detail screen, surface whether
-- the trip's author was the FIRST person in the viewer's network to
-- vouch for the destination. This is the social proof that turns a
-- recommendation into a thesis ("Divyansh was the first in your
-- network to vouch for Spiti, 14 months before the next person.")
--
-- Place identity in our schema is a city's `google_place_id` — the
-- canonical handle for "this destination". The function takes that
-- handle and returns the earliest voucher among the viewer's circle
-- (self + direct follows) plus the gap to the second voucher.
--
-- Scope notes:
--   * City-level only for v0. Venue-level first-to-vouch is a much
--     bigger problem (it requires a place-resolution layer for
--     same-venue-different-google-id cases).
--   * Returns at most one row. The caller's job is to decide whether
--     the gap is "meaningful" (the brief says >= 3 months).
--   * `security invoker` so RLS on `trips` + `cities` + `follows`
--     applies to the caller, not the function definer.
--   * Excludes soft-deleted trips and cities so an old + abandoned
--     trip doesn't shadow a real later one.

create or replace function public.get_first_voucher_for_place(
  p_google_place_id text
)
returns table (
  voucher_user_id uuid,
  voucher_display_name text,
  voucher_trip_id uuid,
  voucher_created_at timestamptz,
  months_gap int
)
language sql
stable
security invoker
set search_path = public
as $$
  with viewer as (
    select auth.uid() as id
  ),
  -- Earliest trip per voucher within the viewer's circle that touches
  -- this place. Group by user so a prolific traveler with many trips
  -- to the same destination doesn't dominate the ranking — only their
  -- earliest vouch counts.
  earliest_per_user as (
    select t.user_id, min(t.created_at) as earliest
    from public.trips t
    join public.cities c on c.trip_id = t.id
    join viewer v on true
    where c.google_place_id = p_google_place_id
      and c.deleted_at is null
      and t.deleted_at is null
      and (
        t.user_id = v.id
        or exists (
          select 1 from public.follows f
          where f.follower_id = v.id and f.followed_id = t.user_id
        )
      )
    group by t.user_id
  ),
  ranked as (
    select
      user_id,
      earliest,
      row_number() over (order by earliest) as rn
    from earliest_per_user
  ),
  first_row as (
    select user_id, earliest from ranked where rn = 1
  ),
  second_row as (
    select earliest from ranked where rn = 2
  )
  select
    fr.user_id as voucher_user_id,
    u.display_name as voucher_display_name,
    -- Surface the earliest matching trip id so the client can deep-link.
    (
      select t.id from public.trips t
      join public.cities c on c.trip_id = t.id
      where t.user_id = fr.user_id
        and c.google_place_id = p_google_place_id
        and t.deleted_at is null
        and c.deleted_at is null
      order by t.created_at asc
      limit 1
    ) as voucher_trip_id,
    fr.earliest as voucher_created_at,
    case
      when sr.earliest is null then null
      else (
        extract(year from age(sr.earliest, fr.earliest))::int * 12
        + extract(month from age(sr.earliest, fr.earliest))::int
      )
    end as months_gap
  from first_row fr
  join public.users u on u.id = fr.user_id
  left join second_row sr on true
  limit 1;
$$;

grant execute on function public.get_first_voucher_for_place(text) to authenticated;

notify pgrst, 'reload schema';
