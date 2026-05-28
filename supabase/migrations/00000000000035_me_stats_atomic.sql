-- Migration 35 — me_stats counts atomic logs alongside legacy tips.
--
-- Pre-atomic-log: tips_given_count counted rows in public.tips.
-- Post-atomic-log: the user's recommendations live in public.venues
-- (with a non-null category). Counting tips alone undercounts honest
-- user activity. We now sum both — legacy tip rows + atomic-log venue
-- rows.

create or replace function public.me_stats()
returns table (
  trips_count int,
  countries_count int,
  tips_given_count int
)
language sql stable security invoker
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
      where c.user_id = auth.uid()
        and c.deleted_at is null
        and c.country_id is not null
    ) as countries_count,
    (
      -- Atomic logs (venues with category) the user has authored.
      (
        select count(*)::int from public.venues v
        where v.user_id = auth.uid()
          and v.category is not null
          and v.deleted_at is null
      )
      +
      -- Legacy tips. Polymorphic — children of trips or cities owned
      -- by the caller.
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
      )
    ) as tips_given_count;
$$;

grant execute on function public.me_stats() to authenticated;
