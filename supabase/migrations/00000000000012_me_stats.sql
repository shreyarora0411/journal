-- Migration 12 — me_stats() RPC.
--
-- Returns trips_count, countries_count, tips_given_count for the calling
-- user. Used by the Profile screen to replace the hardcoded fixture
-- numbers (23 / 11 / 142) with real aggregates.
--
-- security invoker — counts are computed against the underlying tables;
-- the caller's RLS still applies to what they can see, but since we
-- filter by `user_id = auth.uid()` everywhere, the effective surface is
-- always the caller's own rows.

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
      select count(distinct p.country)::int
      from public.places p
      join public.trips t on t.id = p.trip_id
      where t.user_id = auth.uid()
        and p.deleted_at is null
        and t.deleted_at is null
        and p.country is not null
        and p.country <> ''
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
            when 'place' then exists (
              select 1 from public.places p
              join public.trips t on t.id = p.trip_id
              where p.id = ti.parent_id
                and t.user_id = auth.uid()
                and t.deleted_at is null
            )
          end
        )
    ) as tips_given_count;
$$;

grant execute on function public.me_stats() to authenticated;
