-- Migration 32 — resolve_google_place + insert_atomic_log RPCs.
--
-- The atomic-log flow is two server calls:
--   1. resolve_google_place — takes a Google pick + addressComponents,
--      returns the resolved kind (country / city / area / venue) and
--      the existing-or-newly-created ids for the geographic chain.
--   2. insert_atomic_log — given a city_id + content, writes the venue
--      row that carries category / one_line / prose / trip_id /
--      visibility. Returns the venue id.
--
-- Both are security invoker; auth.uid() is the row owner.

create or replace function public.resolve_google_place(
  p_google_place_id text,
  p_name text,
  p_types text[],
  p_lat double precision,
  p_lng double precision,
  p_country_iso2 text,
  p_country_name text,
  p_parent_locality_name text,
  p_parent_locality_place_id text
)
returns table (
  resolved_kind text,
  country_id uuid,
  city_id uuid,
  area_id uuid,
  venue_id uuid
)
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_country_id uuid;
  v_city_id uuid;
  v_area_id uuid;
  v_venue_id uuid;
  v_resolved_kind text;
  v_caller_id uuid := auth.uid();
begin
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Country lookup (no creation — countries are seeded).
  if p_country_iso2 is not null then
    select id into v_country_id from public.countries
      where iso_alpha2 = upper(p_country_iso2);
  end if;
  if v_country_id is null and p_country_name is not null then
    select id into v_country_id from public.countries
      where lower(display_name) = lower(p_country_name);
  end if;

  -- 2. Determine what was picked.
  if p_types @> array['country'] then
    v_resolved_kind := 'country';
  elsif p_types && array['locality', 'administrative_area_level_1', 'administrative_area_level_2'] then
    v_resolved_kind := 'city';
  elsif p_types && array['sublocality', 'neighborhood', 'sublocality_level_1'] then
    v_resolved_kind := 'area';
  else
    v_resolved_kind := 'venue';
  end if;

  -- 3. For venue / area: also resolve or create the parent city.
  if v_resolved_kind in ('venue', 'area') and p_parent_locality_name is not null then
    select id into v_city_id from public.cities
      where user_id = v_caller_id
        and deleted_at is null
        and (
          (google_place_id is not null and google_place_id = p_parent_locality_place_id)
          or lower(name) = lower(p_parent_locality_name)
        )
      limit 1;

    if v_city_id is null then
      insert into public.cities (
        user_id, name, google_place_id, country_id, trip_id, position
      ) values (
        v_caller_id, p_parent_locality_name, p_parent_locality_place_id, v_country_id, null, 0
      )
      returning id into v_city_id;
    end if;
  end if;

  -- 4. Handle the resolved kind.
  if v_resolved_kind = 'city' then
    select id into v_city_id from public.cities
      where user_id = v_caller_id
        and deleted_at is null
        and (
          (google_place_id is not null and google_place_id = p_google_place_id)
          or lower(name) = lower(p_name)
        )
      limit 1;

    if v_city_id is null then
      insert into public.cities (
        user_id, name, google_place_id, country_id, lat, lng, trip_id, position
      ) values (
        v_caller_id, p_name, p_google_place_id, v_country_id, p_lat, p_lng, null, 0
      )
      returning id into v_city_id;
    end if;

  elsif v_resolved_kind = 'area' then
    if v_city_id is not null then
      select id into v_area_id from public.areas
        where user_id = v_caller_id
          and city_id = v_city_id
          and lower(name) = lower(p_name)
          and deleted_at is null
        limit 1;

      if v_area_id is null then
        insert into public.areas (
          user_id, city_id, name, lat, lng
        ) values (
          v_caller_id, v_city_id, p_name, p_lat, p_lng
        )
        returning id into v_area_id;
      end if;
    end if;

  elsif v_resolved_kind = 'venue' then
    -- Venue row is created by insert_atomic_log so it can carry
    -- category / one_line / prose. This function only resolves the
    -- geographic chain.
    v_venue_id := null;
  end if;

  return query select v_resolved_kind, v_country_id, v_city_id, v_area_id, v_venue_id;
end;
$$;

grant execute on function public.resolve_google_place(
  text, text, text[], double precision, double precision, text, text, text, text
) to authenticated;

-- =========================================================================

create or replace function public.insert_atomic_log(
  p_city_id uuid,
  p_area_id uuid,
  p_google_place_id text,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_category text,
  p_one_line text,
  p_prose text,
  p_trip_id uuid,
  p_visibility public.visibility
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_caller_id uuid := auth.uid();
begin
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_category not in ('stay', 'food', 'drinks', 'wander', 'buy') then
    raise exception 'Invalid category: %', p_category;
  end if;

  if p_one_line is null or length(trim(p_one_line)) = 0 then
    raise exception 'one_line is required';
  end if;

  if p_city_id is not null then
    if not exists (
      select 1 from public.cities
      where id = p_city_id and user_id = v_caller_id and deleted_at is null
    ) then
      raise exception 'City does not belong to caller';
    end if;
  end if;

  if p_trip_id is not null then
    if not exists (
      select 1 from public.trips
      where id = p_trip_id and user_id = v_caller_id and deleted_at is null
    ) then
      raise exception 'Trip does not belong to caller';
    end if;
  end if;

  -- Upsert by (user_id, google_place_id) so re-logging the same place
  -- updates the existing row rather than failing on the unique index.
  if p_google_place_id is not null then
    insert into public.venues (
      user_id, city_id, area_id, name, google_place_id,
      kind, category, one_line, prose, trip_id, visibility, lat, lng
    ) values (
      v_caller_id, p_city_id, p_area_id, p_name, p_google_place_id,
      'other', p_category, p_one_line, p_prose, p_trip_id,
      coalesce(p_visibility, 'friends_of_friends'::public.visibility), p_lat, p_lng
    )
    on conflict (user_id, google_place_id) where google_place_id is not null and deleted_at is null
    do update set
      city_id = excluded.city_id,
      area_id = excluded.area_id,
      name = excluded.name,
      category = excluded.category,
      one_line = excluded.one_line,
      prose = excluded.prose,
      trip_id = excluded.trip_id,
      visibility = excluded.visibility,
      lat = excluded.lat,
      lng = excluded.lng
    returning id into v_venue_id;
  else
    insert into public.venues (
      user_id, city_id, area_id, name,
      kind, category, one_line, prose, trip_id, visibility, lat, lng
    ) values (
      v_caller_id, p_city_id, p_area_id, p_name,
      'other', p_category, p_one_line, p_prose, p_trip_id,
      coalesce(p_visibility, 'friends_of_friends'::public.visibility), p_lat, p_lng
    )
    returning id into v_venue_id;
  end if;

  return v_venue_id;
end;
$$;

grant execute on function public.insert_atomic_log(
  uuid, uuid, text, text, double precision, double precision,
  text, text, text, uuid, public.visibility
) to authenticated;
