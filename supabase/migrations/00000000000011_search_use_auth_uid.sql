-- Migration 11 — search_friend_graph reads auth.uid() internally
-- (Fix 3 of the pre-pilot list).
--
-- Bug: the previous signature took `viewer uuid` and trusted it. A
-- malicious caller could pass any UUID and read someone else's search
-- result set. Drop the parameter; read auth.uid() directly.
--
-- Also: change SECURITY DEFINER → SECURITY INVOKER. The function never
-- needed elevated privileges — `is_visible_to` enforces the per-trip
-- visibility check against the caller's identity, and the underlying
-- tables already have RLS the invoker is bound by.

drop function if exists public.search_friend_graph(text, uuid);

create or replace function public.search_friend_graph(q text)
returns table (
  kind public.search_result_kind,
  id uuid,
  trip_id uuid,
  trip_title text,
  trip_user_id uuid,
  name text,
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
    select
      'place'::public.search_result_kind as kind,
      p.id,
      p.trip_id,
      t.title as trip_title,
      t.user_id as trip_user_id,
      p.name,
      null::text as quote,
      ts_rank(p.search_vec, n.tsq) as rank,
      p.created_at
    from public.places p
    join public.trips t on t.id = p.trip_id
    cross join normalized n
    cross join viewer v
    where p.deleted_at is null
      and t.deleted_at is null
      and p.search_vec @@ n.tsq
      and public.is_visible_to(v.id, t.user_id, t.visibility)
    union all
    select
      'venue'::public.search_result_kind,
      vn.id,
      t.id as trip_id,
      t.title,
      t.user_id,
      vn.name,
      vn.quote,
      ts_rank(vn.search_vec, n.tsq),
      vn.created_at
    from public.venues vn
    join public.places p on p.id = vn.place_id
    join public.trips t on t.id = p.trip_id
    cross join normalized n
    cross join viewer v
    where vn.deleted_at is null
      and p.deleted_at is null
      and t.deleted_at is null
      and vn.search_vec @@ n.tsq
      and public.is_visible_to(v.id, t.user_id, t.visibility)
    union all
    select
      'area'::public.search_result_kind,
      a.id,
      t.id as trip_id,
      t.title,
      t.user_id,
      a.name,
      a.quote,
      ts_rank(a.search_vec, n.tsq),
      a.created_at
    from public.areas a
    join public.places p on p.id = a.place_id
    join public.trips t on t.id = p.trip_id
    cross join normalized n
    cross join viewer v
    where a.deleted_at is null
      and p.deleted_at is null
      and t.deleted_at is null
      and a.search_vec @@ n.tsq
      and public.is_visible_to(v.id, t.user_id, t.visibility)
    union all
    select
      'tip'::public.search_result_kind,
      ti.id,
      case ti.parent_type
        when 'trip' then ti.parent_id
        when 'place' then (select trip_id from public.places where id = ti.parent_id)
      end as trip_id,
      (case ti.parent_type
        when 'trip' then (select title from public.trips where id = ti.parent_id)
        when 'place' then (
          select t2.title
          from public.places p2
          join public.trips t2 on t2.id = p2.trip_id
          where p2.id = ti.parent_id
        )
      end) as trip_title,
      (case ti.parent_type
        when 'trip' then (select user_id from public.trips where id = ti.parent_id)
        when 'place' then (
          select t2.user_id
          from public.places p2
          join public.trips t2 on t2.id = p2.trip_id
          where p2.id = ti.parent_id
        )
      end) as trip_user_id,
      ti.body as name,
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
          when 'place' then exists (
            select 1 from public.places p
            join public.trips t on t.id = p.trip_id
            where p.id = ti.parent_id and t.deleted_at is null
              and public.is_visible_to(v.id, t.user_id, t.visibility)
          )
        end
      )
  ) all_results
  order by rank desc, created_at desc
  limit 200;
$$;

grant execute on function public.search_friend_graph(text) to authenticated;
