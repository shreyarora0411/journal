-- Phase 3.1, 3.4: follows, friends-of-friends view, is_visible_to(), full-text
-- search across the friend graph. Widens RLS on trips and children so visibility
-- (followers / friends_of_friends / everyone) is actually honoured for reads.

-- ===========================================================================
-- 3.4 Follows
-- ===========================================================================

create table public.follows (
  follower_id uuid not null references public.users (id) on delete cascade,
  followed_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index follows_followed_idx on public.follows (followed_id);
create index follows_follower_idx on public.follows (follower_id);

alter table public.follows enable row level security;

-- Anyone authenticated can read the graph (no graph privacy in v0).
create policy follows_authenticated_read on public.follows for select
  to authenticated using (true);

-- Only the follower can create/delete their own edges.
create policy follows_owner_insert on public.follows for insert
  with check (auth.uid() = follower_id);
create policy follows_owner_delete on public.follows for delete
  using (auth.uid() = follower_id);

-- ===========================================================================
-- 3.1 Friends-of-friends materialised view
-- ===========================================================================
-- Pre-computed pairs (viewer, target). One row per second-hop relationship.
-- Excludes self and direct follows (those are already handled by the
-- 'followers' visibility level).

create materialized view public.mv_friends_of_friends as
  select distinct
    f1.follower_id as viewer_id,
    f2.followed_id as target_id
  from public.follows f1
  join public.follows f2 on f2.follower_id = f1.followed_id
  where f1.follower_id <> f2.followed_id
    and not exists (
      select 1 from public.follows direct
      where direct.follower_id = f1.follower_id
        and direct.followed_id = f2.followed_id
    );

create unique index mv_fof_pk on public.mv_friends_of_friends (viewer_id, target_id);
create index mv_fof_viewer_idx on public.mv_friends_of_friends (viewer_id);

-- Refresh on every follow change. Cheap at pilot scale; revisit if N grows.
create or replace function public.refresh_mv_friends_of_friends()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_friends_of_friends;
  return null;
end;
$$;

-- `refresh concurrently` requires the unique index, which we just created.
-- The trigger is `after` (not `for each row`) so we coalesce bursts.
create trigger follows_refresh_mv
  after insert or delete on public.follows
  for each statement execute function public.refresh_mv_friends_of_friends();

-- ===========================================================================
-- 3.1 is_visible_to()
-- ===========================================================================

create or replace function public.is_visible_to(viewer uuid, trip_owner uuid, vis public.visibility)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    viewer is not null
    and (
      viewer = trip_owner
      or vis = 'everyone'
      or (vis = 'followers' and exists (
        select 1 from public.follows
        where follower_id = viewer and followed_id = trip_owner
      ))
      or (vis = 'friends_of_friends' and (
        exists (
          select 1 from public.follows
          where follower_id = viewer and followed_id = trip_owner
        )
        or exists (
          select 1 from public.mv_friends_of_friends
          where viewer_id = viewer and target_id = trip_owner
        )
      ))
    );
$$;

-- ===========================================================================
-- 3.1 Widen RLS on trips + child entities to honour visibility
-- ===========================================================================
-- The Phase 2 owner-only policies stay. We add read policies for everyone-else
-- gated by is_visible_to. Inserts/updates/deletes remain owner-only.

create policy trips_visible_read on public.trips for select
  using (
    deleted_at is null
    and public.is_visible_to(auth.uid(), user_id, visibility)
  );

create policy places_visible_read on public.places for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.trips t
      where t.id = trip_id
        and t.deleted_at is null
        and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
    )
  );

create policy venues_visible_read on public.venues for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.places p
      join public.trips t on t.id = p.trip_id
      where p.id = place_id
        and t.deleted_at is null
        and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
    )
  );

create policy areas_visible_read on public.areas for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.places p
      join public.trips t on t.id = p.trip_id
      where p.id = place_id
        and t.deleted_at is null
        and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
    )
  );

create policy tips_visible_read on public.tips for select
  using (
    deleted_at is null
    and (
      case parent_type
        when 'trip' then exists (
          select 1 from public.trips t
          where t.id = parent_id
            and t.deleted_at is null
            and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
        )
        when 'place' then exists (
          select 1 from public.places p
          join public.trips t on t.id = p.trip_id
          where p.id = parent_id
            and t.deleted_at is null
            and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
        )
      end
    )
  );

create policy trip_photos_visible_read on public.trip_photos for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.trips t
      where t.id = trip_id
        and t.deleted_at is null
        and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
    )
  );

-- ===========================================================================
-- 3.3 Handles — auto-generate when needed
-- ===========================================================================
-- Build plan defers handle picking post-v0. For pilot, every user gets a
-- random `user_<8>` handle on insert. Existing rows get backfilled now.

create or replace function public.gen_user_handle()
returns text
language plpgsql
as $$
declare
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := 'user_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    attempts := attempts + 1;
    exit when not exists (select 1 from public.users where handle = candidate);
    if attempts > 5 then
      candidate := 'user_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
      exit;
    end if;
  end loop;
  return candidate;
end;
$$;

-- Extend handle_new_user to also set a handle.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, handle)
  values (new.id, public.gen_user_handle())
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill existing handle-less rows (the pilot's accumulated anonymous users).
update public.users
set handle = public.gen_user_handle()
where handle is null;

-- ===========================================================================
-- 3.1 Full-text search
-- ===========================================================================
-- Generated tsvector columns on the four searchable entities. We use
-- `simple` dictionary so place names like "Bir" don't get stemmed.

alter table public.places
  add column search_vec tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(region, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(country, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(note, '')), 'C')
  ) stored;
create index places_search_idx on public.places using gin (search_vec);

alter table public.venues
  add column search_vec tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(quote, '')), 'B')
  ) stored;
create index venues_search_idx on public.venues using gin (search_vec);

alter table public.areas
  add column search_vec tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(quote, '')), 'B')
  ) stored;
create index areas_search_idx on public.areas using gin (search_vec);

alter table public.tips
  add column search_vec tsvector generated always as (
    to_tsvector('simple', coalesce(body, ''))
  ) stored;
create index tips_search_idx on public.tips using gin (search_vec);

-- ===========================================================================
-- 3.1 search_friend_graph()
-- ===========================================================================
-- Returns visible matches across places, venues, areas, tips for one viewer.
-- Caller is always auth.uid(); we pass it explicitly so the function is
-- testable with explicit input. RLS-equivalent visibility is enforced via
-- is_visible_to inside the SQL.

create type public.search_result_kind as enum ('place', 'venue', 'area', 'tip');

create or replace function public.search_friend_graph(q text, viewer uuid)
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
security definer
set search_path = public
as $$
  with normalized as (
    -- websearch_to_tsquery handles spaces and OR-like input gracefully.
    select websearch_to_tsquery('simple', q) as tsq
  )
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
    where p.deleted_at is null
      and t.deleted_at is null
      and p.search_vec @@ n.tsq
      and public.is_visible_to(viewer, t.user_id, t.visibility)
    union all
    select
      'venue'::public.search_result_kind,
      v.id,
      t.id as trip_id,
      t.title,
      t.user_id,
      v.name,
      v.quote,
      ts_rank(v.search_vec, n.tsq),
      v.created_at
    from public.venues v
    join public.places p on p.id = v.place_id
    join public.trips t on t.id = p.trip_id
    cross join normalized n
    where v.deleted_at is null
      and p.deleted_at is null
      and t.deleted_at is null
      and v.search_vec @@ n.tsq
      and public.is_visible_to(viewer, t.user_id, t.visibility)
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
    where a.deleted_at is null
      and p.deleted_at is null
      and t.deleted_at is null
      and a.search_vec @@ n.tsq
      and public.is_visible_to(viewer, t.user_id, t.visibility)
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
        when 'place' then (select t2.title from public.places p2 join public.trips t2 on t2.id = p2.trip_id where p2.id = ti.parent_id)
      end) as trip_title,
      (case ti.parent_type
        when 'trip' then (select user_id from public.trips where id = ti.parent_id)
        when 'place' then (select t2.user_id from public.places p2 join public.trips t2 on t2.id = p2.trip_id where p2.id = ti.parent_id)
      end) as trip_user_id,
      ti.body as name,
      null::text as quote,
      ts_rank(ti.search_vec, n.tsq),
      ti.created_at
    from public.tips ti
    cross join normalized n
    where ti.deleted_at is null
      and ti.search_vec @@ n.tsq
      and (
        case ti.parent_type
          when 'trip' then exists (
            select 1 from public.trips t
            where t.id = ti.parent_id and t.deleted_at is null
              and public.is_visible_to(viewer, t.user_id, t.visibility)
          )
          when 'place' then exists (
            select 1 from public.places p
            join public.trips t on t.id = p.trip_id
            where p.id = ti.parent_id and t.deleted_at is null
              and public.is_visible_to(viewer, t.user_id, t.visibility)
          )
        end
      )
  ) all_results
  order by rank desc, created_at desc
  limit 200;
$$;
