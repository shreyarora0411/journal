-- Migration 42 — Lists replace trips as the vouch container.
--
-- Conceptual change: a Vouch no longer belongs to one temporal Trip. It now
-- belongs to one-or-more user-named Lists (place / occasion / theme) via a
-- many-to-many join. Plans collapse into Lists too — "one container concept"
-- (v3.1 brief §6).
--
-- We reuse the existing `lists` table as the List entity (it already has
-- owner_id, title, visibility, cover_color) and add a dedicated
-- `vouch_list_items` join exactly as the brief specifies. We do NOT reuse the
-- legacy polymorphic `list_items` (trip/city/venue) — keeping the vouch join
-- separate avoids overloading that table and dodges the enum-in-transaction
-- problem.
--
-- The `trips` TABLE stays: the legacy atomic-log feed / trip-detail / cities
-- surfaces (kept as fallback) still depend on it. Only v3 vouches detach.

-- ---- List: extend the existing lists table --------------------------------
-- Optional place anchor for search; null for theme lists ("best mountain stays").
alter table public.lists
  add column if not exists destination_text text;

-- ---- Vouch: detach from trips (stand alone) -------------------------------
alter table public.vouches
  drop column if exists trip_id;

-- ---- VouchListItem: the many-to-many join ---------------------------------
create table if not exists public.vouch_list_items (
  id uuid primary key default gen_random_uuid(),
  vouch_id uuid not null references public.vouches (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  added_by_user_id uuid references public.users (id) on delete set null,
  added_at timestamptz not null default now(),
  unique (vouch_id, list_id)
);

create index if not exists vli_list_idx on public.vouch_list_items (list_id);
create index if not exists vli_vouch_idx on public.vouch_list_items (vouch_id);

alter table public.vouch_list_items enable row level security;

-- A vouch_list_item is readable when the parent list is readable by the viewer
-- (own list, or a trusted-circle list they can see). Writable only by the list
-- owner (you control what lands in your list — including saving someone else's
-- vouch into it).
drop policy if exists vli_read on public.vouch_list_items;
create policy vli_read on public.vouch_list_items
  for select
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_id
        and l.deleted_at is null
        and (l.owner_id = auth.uid() or public.is_visible_to(auth.uid(), l.owner_id, l.visibility))
    )
  );

drop policy if exists vli_owner_write on public.vouch_list_items;
create policy vli_owner_write on public.vouch_list_items
  for all
  using (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid()));

grant select, insert, update, delete on public.vouch_list_items to authenticated;

-- ---- Collapse Plan / SavedVouch into List ---------------------------------
drop table if exists public.saved_vouches cascade;
drop table if exists public.plans cascade;

-- ---- Retarget search_vouches: source TRIP → source LIST -------------------
-- Ranking math is unchanged (relationship_trust .55 etc.). The only change is
-- the source-context join: a vouch's "source list" is a list it belongs to
-- (preferring one owned by the author, destination-anchored). trip_title /
-- trip_verdict are replaced by list_id / list_title.

drop function if exists public.search_vouches(text, text);

create or replace function public.search_vouches(
  p_destination text,
  p_context text default null
)
returns table (
  vouch_id uuid,
  list_id uuid,
  list_title text,
  vouch_text text,
  vouch_type text,
  destination_text text,
  author_id uuid,
  author_name text,
  author_handle text,
  author_avatar text,
  is_own boolean,
  is_trusted boolean,
  context_match boolean,
  score double precision,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with viewer as (select auth.uid() as id),
  trust as (
    select f.followed_id as person_id, f.trust_contexts
    from public.follows f, viewer v
    where f.follower_id = v.id and f.status = 'accepted'
  ),
  candidates as (
    select
      vch.id, vch.text, vch.vouch_type, vch.destination_text,
      vch.user_id as author_id, vch.created_at,
      u.display_name as author_name, u.handle as author_handle, u.avatar_url as author_avatar,
      (vch.user_id = (select id from viewer)) as is_own,
      (tr.person_id is not null) as is_trusted,
      coalesce(
        tr.trust_contexts && (
          case vch.vouch_type
            when 'stay' then array['stays']
            when 'eat_drink' then array['food']
            when 'good_to_know' then array['local_logistics']
            else array[]::text[]
          end
        ), false
      ) as context_match,
      -- The representative source list: a list owned by the vouch's author
      -- that contains it, preferring a destination-anchored one.
      (
        select l.id from public.vouch_list_items vli
        join public.lists l on l.id = vli.list_id
        where vli.vouch_id = vch.id and l.owner_id = vch.user_id and l.deleted_at is null
        order by (l.destination_text is not null) desc, l.created_at asc
        limit 1
      ) as src_list_id
    from public.vouches vch
    join public.users u on u.id = vch.user_id
    left join trust tr on tr.person_id = vch.user_id
    where vch.deleted_at is null
      and vch.destination_text ilike '%' || p_destination || '%'
  )
  select
    c.id,
    c.src_list_id,
    (select l.title from public.lists l where l.id = c.src_list_id) as list_title,
    c.text, c.vouch_type, c.destination_text,
    c.author_id, c.author_name, c.author_handle, c.author_avatar,
    c.is_own, c.is_trusted, c.context_match,
    (
      0.55 * (case
          when c.is_own then 1.00
          when c.is_trusted and c.context_match then 0.95
          when c.is_trusted then 0.85
          else 0.40 end)
      + 0.25 * 1.00
      + 0.15 * least(1.0,
          (case when array_length(regexp_split_to_array(btrim(c.text), '\s+'), 1) >= 4 then 0.8
                when array_length(regexp_split_to_array(btrim(c.text), '\s+'), 1) >= 2 then 0.5
                else 0.2 end)
          + (case when c.text ~* '\y(skip|unless|only|not|book|ask|before|after)\y' then 0.2 else 0 end))
      + 0.05 * (case
          when c.created_at > now() - interval '90 days' then 1.0
          when c.created_at > now() - interval '365 days' then 0.6
          else 0.3 end)
    ) as score,
    c.created_at
  from candidates c
  order by score desc, c.created_at desc;
$$;

grant execute on function public.search_vouches(text, text) to authenticated;

notify pgrst, 'reload schema';
