-- Migration 24 — rebuild every SQL function / view that referenced
-- the old `places` table by name. PG views (parse-tree storage) survive
-- table renames; SQL function bodies (text storage) don't. This
-- migration rewrites those bodies and renames the one dependent view.

-- 1. search_friend_graph ---------------------------------------------------
-- Signature gains `country_name` for the city/venue/area arms (joined
-- from the new countries table). New union arm: country results, so
-- searching "Japan" surfaces the country itself plus cities inside it.

drop function if exists public.search_friend_graph(text);

create or replace function public.search_friend_graph(q text)
returns table (
  kind public.search_result_kind,
  id uuid,
  trip_id uuid,
  trip_title text,
  trip_user_id uuid,
  name text,
  country_name text,
  quote text,
  rank real,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with viewer as (select auth.uid() as id),
  normalized as (select websearch_to_tsquery('simple', q) as tsq)
  select * from (
    -- Cities (formerly 'place' search results) -------------------------------
    select
      'city'::public.search_result_kind as kind,
      c.id,
      c.trip_id,
      t.title as trip_title,
      t.user_id as trip_user_id,
      c.name,
      co.display_name as country_name,
      null::text as quote,
      ts_rank(c.search_vec, n.tsq) as rank,
      c.created_at
    from public.cities c
    join public.trips t on t.id = c.trip_id
    left join public.countries co on co.id = c.country_id
    cross join normalized n
    cross join viewer v
    where c.deleted_at is null
      and t.deleted_at is null
      and c.search_vec @@ n.tsq
      and public.is_visible_to(v.id, t.user_id, t.visibility)

    union all

    -- Venues -----------------------------------------------------------------
    select
      'venue'::public.search_result_kind,
      vn.id,
      t.id as trip_id,
      t.title,
      t.user_id,
      vn.name,
      co.display_name as country_name,
      vn.quote,
      ts_rank(vn.search_vec, n.tsq),
      vn.created_at
    from public.venues vn
    join public.cities c on c.id = vn.city_id
    join public.trips t on t.id = c.trip_id
    left join public.countries co on co.id = c.country_id
    cross join normalized n
    cross join viewer v
    where vn.deleted_at is null
      and c.deleted_at is null
      and t.deleted_at is null
      and vn.search_vec @@ n.tsq
      and public.is_visible_to(v.id, t.user_id, t.visibility)

    union all

    -- Areas ------------------------------------------------------------------
    select
      'area'::public.search_result_kind,
      a.id,
      t.id as trip_id,
      t.title,
      t.user_id,
      a.name,
      co.display_name as country_name,
      a.quote,
      ts_rank(a.search_vec, n.tsq),
      a.created_at
    from public.areas a
    join public.cities c on c.id = a.city_id
    join public.trips t on t.id = c.trip_id
    left join public.countries co on co.id = c.country_id
    cross join normalized n
    cross join viewer v
    where a.deleted_at is null
      and c.deleted_at is null
      and t.deleted_at is null
      and a.search_vec @@ n.tsq
      and public.is_visible_to(v.id, t.user_id, t.visibility)

    union all

    -- Countries (top-level result, not gated by visibility — global) ---------
    select
      'country'::public.search_result_kind,
      co.id,
      null::uuid as trip_id,
      null::text as trip_title,
      null::uuid as trip_user_id,
      co.display_name as name,
      co.display_name as country_name,
      null::text as quote,
      ts_rank(to_tsvector('simple', co.display_name), n.tsq) as rank,
      co.created_at
    from public.countries co
    cross join normalized n
    where to_tsvector('simple', co.display_name) @@ n.tsq

    union all

    -- Tips (polymorphic — child of trip OR city) -----------------------------
    select
      'tip'::public.search_result_kind,
      ti.id,
      case ti.parent_type
        when 'trip' then ti.parent_id
        when 'city' then (select trip_id from public.cities where id = ti.parent_id)
      end as trip_id,
      (case ti.parent_type
        when 'trip' then (select title from public.trips where id = ti.parent_id)
        when 'city' then (
          select t2.title
          from public.cities c2
          join public.trips t2 on t2.id = c2.trip_id
          where c2.id = ti.parent_id
        )
      end) as trip_title,
      (case ti.parent_type
        when 'trip' then (select user_id from public.trips where id = ti.parent_id)
        when 'city' then (
          select t2.user_id
          from public.cities c2
          join public.trips t2 on t2.id = c2.trip_id
          where c2.id = ti.parent_id
        )
      end) as trip_user_id,
      ti.body as name,
      null::text as country_name,
      null::text as quote,
      ts_rank(ti.search_vec, n.tsq),
      ti.created_at
    from public.tips ti
    cross join normalized n
    cross join viewer v
    where ti.deleted_at is null
      and ti.search_vec @@ n.tsq
      and (
        case ti.parent_type
          when 'trip' then exists (
            select 1 from public.trips t
            where t.id = ti.parent_id and t.deleted_at is null
              and public.is_visible_to(v.id, t.user_id, t.visibility)
          )
          when 'city' then exists (
            select 1 from public.cities c
            join public.trips t on t.id = c.trip_id
            where c.id = ti.parent_id and t.deleted_at is null
              and public.is_visible_to(v.id, t.user_id, t.visibility)
          )
        end
      )
  ) all_results
  order by rank desc, created_at desc
  limit 200;
$$;

grant execute on function public.search_friend_graph(text) to authenticated;

-- 2. me_stats -------------------------------------------------------------
-- countries_count switches from count(distinct cities.country text) to
-- count(distinct cities.country_id). Tips parent_type 'place' is now 'city'.

create or replace function public.me_stats()
returns table (
  trips_count int,
  countries_count int,
  tips_given_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (
      select count(*)::int from public.trips
      where user_id = auth.uid() and deleted_at is null
    ) as trips_count,
    (
      select count(distinct c.country_id)::int
      from public.cities c
      join public.trips t on t.id = c.trip_id
      where t.user_id = auth.uid()
        and c.deleted_at is null
        and t.deleted_at is null
        and c.country_id is not null
    ) as countries_count,
    (
      select count(*)::int from public.tips ti
      where ti.deleted_at is null
        and (
          case ti.parent_type
            when 'trip' then exists (
              select 1 from public.trips t
              where t.id = ti.parent_id
                and t.user_id = auth.uid()
                and t.deleted_at is null
            )
            when 'city' then exists (
              select 1 from public.cities c
              join public.trips t on t.id = c.trip_id
              where c.id = ti.parent_id
                and t.user_id = auth.uid()
                and t.deleted_at is null
            )
          end
        )
    ) as tips_given_count;
$$;

grant execute on function public.me_stats() to authenticated;

-- 3. verdict_counts --------------------------------------------------------
-- enum value 'place' → 'city'; subquery uses public.cities + city_id.

create or replace function public.verdict_counts(
  target_type public.verdict_target,
  target_id uuid
)
returns table (
  love_count int,
  mid_count int,
  skip_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  with allowed as (
    select case target_type
      when 'trip' then exists (
        select 1 from public.trips t
        where t.id = target_id and t.deleted_at is null
          and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
      )
      when 'city' then exists (
        select 1 from public.cities c
        join public.trips t on t.id = c.trip_id
        where c.id = target_id and t.deleted_at is null
          and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
      )
      when 'venue' then exists (
        select 1 from public.venues v
        join public.cities c on c.id = v.city_id
        join public.trips t on t.id = c.trip_id
        where v.id = target_id and t.deleted_at is null
          and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
      )
    end as ok
  )
  select
    coalesce((
      select count(*) filter (where v.verdict = 'love')
      from public.verdicts v
      where v.target_type = verdict_counts.target_type
        and v.target_id = verdict_counts.target_id
    ), 0)::int,
    coalesce((
      select count(*) filter (where v.verdict = 'mid')
      from public.verdicts v
      where v.target_type = verdict_counts.target_type
        and v.target_id = verdict_counts.target_id
    ), 0)::int,
    coalesce((
      select count(*) filter (where v.verdict = 'skip')
      from public.verdicts v
      where v.target_type = verdict_counts.target_type
        and v.target_id = verdict_counts.target_id
    ), 0)::int
  from allowed
  where allowed.ok;
$$;

grant execute on function public.verdict_counts(public.verdict_target, uuid)
  to authenticated;

-- 4. canonical_places view → canonical_cities -----------------------------
-- Re-aggregates per-trip city rows into a canonical key. country text is
-- gone; group by country_id and join countries for the display name.

drop view if exists public.canonical_places;

create or replace view public.canonical_cities as
  select
    lower(c.name) || '|' || coalesce(co.iso_alpha2, '') as canonical_key,
    lower(c.name) as canonical_name,
    (array_agg(c.name order by c.created_at))[1] as display_name,
    co.id as country_id,
    co.display_name as country_name,
    co.iso_alpha2 as country_iso,
    array_agg(distinct c.id) as city_ids,
    array_agg(distinct t.id) as trip_ids,
    array_agg(distinct t.user_id) as user_ids,
    count(distinct t.user_id) as saved_by_count,
    min(c.created_at) as first_seen_at,
    max(c.created_at) as last_seen_at
  from public.cities c
  join public.trips t on t.id = c.trip_id
  left join public.countries co on co.id = c.country_id
  where c.deleted_at is null and t.deleted_at is null
  group by lower(c.name), co.id, co.display_name, co.iso_alpha2;

grant select on public.canonical_cities to authenticated;
