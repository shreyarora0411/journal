-- Migration 51 — learn "you trust X for food / stays" from BEHAVIOUR, not
-- manual tagging (revealed preference over stated). The food-friend / stays-
-- friend use case: when a viewer repeatedly SAVES or ACTS-ON (Open in Maps /
-- Share) a particular author's vouches in a category, we infer trust for that
-- (author, context) and write it into follows.trust_contexts — the same column
-- the search ranking (migration 49) and the "You trust X for {ctx}" line
-- (vouchReason) already consume. No new ranking surface, no new UI; this just
-- POPULATES an existing signal from real interactions instead of seed data.
--
-- (1) vouch_interactions — one row per (viewer acts on an author's vouch). The
--     raw behavioural log we count distinct vouches over. viewer-private:
--     RLS lets a viewer insert/select only their own rows (viewer_id =
--     auth.uid()), nothing else.
--
-- (2) record_vouch_interaction(p_vouch_id, p_kind) — security INVOKER so it
--     runs as the caller (RLS on vouch_interactions + follows applies). It
--     logs the interaction, then promotes the (author, context) to a trust
--     context once the viewer has acted on enough DISTINCT vouches of that
--     author in that category.

create table if not exists public.vouch_interactions (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.users (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  vouch_id uuid not null references public.vouches (id) on delete cascade,
  vouch_type text not null,
  kind text not null check (kind in ('save','maps','share')),
  created_at timestamptz not null default now()
);

-- We count DISTINCT vouches per (viewer, author, context), so the hot lookup
-- is by (viewer_id, author_id).
create index if not exists vouch_interactions_viewer_author_idx
  on public.vouch_interactions (viewer_id, author_id);

alter table public.vouch_interactions enable row level security;

-- Viewer-private: a viewer may only ever see / write their OWN interaction
-- rows. There is deliberately no policy exposing another user's behavioural
-- log — revealed preference is private.
drop policy if exists vouch_interactions_own_select on public.vouch_interactions;
create policy vouch_interactions_own_select on public.vouch_interactions
  for select
  using (viewer_id = auth.uid());

drop policy if exists vouch_interactions_own_insert on public.vouch_interactions;
create policy vouch_interactions_own_insert on public.vouch_interactions
  for insert
  with check (viewer_id = auth.uid());

grant select, insert on public.vouch_interactions to authenticated;

-- vouch_type -> trust context map. Mirrors the search ranking + composer:
--   stay -> stays, eat_drink -> food, good_to_know -> local_logistics,
--   nightlife -> nightlife. do / skip have no context (we don't learn trust
--   from them). Returns null for anything we don't learn from.
create or replace function public.vouch_type_to_context(p_vouch_type text)
returns text
language sql immutable set search_path = public
as $$
  select case p_vouch_type
    when 'stay' then 'stays'
    when 'eat_drink' then 'food'
    when 'good_to_know' then 'local_logistics'
    when 'nightlife' then 'nightlife'
    else null
  end;
$$;

-- THRESHOLD — promote (author, context) to a trust context once the viewer has
-- acted on >= 2 DISTINCT vouches of that author in that category. Two is the
-- smallest count that reads as a pattern rather than a one-off: a single save
-- could be incidental, two distinct vouches in the same category is a
-- revealed "I keep going to X for this". Kept low on purpose — trust is
-- additive only (we never remove a context here), and the ranking already
-- weights context_match modestly (0.85 -> 0.95), so a false positive is cheap.
create or replace function public.record_vouch_interaction(
  p_vouch_id uuid,
  p_kind text
)
returns void
language plpgsql security invoker set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_author uuid;
  v_vouch_type text;
  v_context text;
  v_distinct integer;
begin
  if v_viewer is null then
    return;
  end if;

  -- Resolve the vouch's author + type. If the vouch isn't visible to the
  -- viewer (RLS) or doesn't exist, there's nothing to learn from.
  select vch.user_id, vch.vouch_type
    into v_author, v_vouch_type
  from public.vouches vch
  where vch.id = p_vouch_id and vch.deleted_at is null;

  if v_author is null then
    return;
  end if;

  -- Never learn from your own vouches — acting on your own pick says nothing
  -- about whom YOU trust.
  if v_author = v_viewer then
    return;
  end if;

  -- Log the raw interaction. The kind check constraint guards p_kind.
  insert into public.vouch_interactions (viewer_id, author_id, vouch_id, vouch_type, kind)
  values (v_viewer, v_author, p_vouch_id, v_vouch_type, p_kind);

  -- Map to a learnable context. do / skip -> null -> nothing to promote.
  v_context := public.vouch_type_to_context(v_vouch_type);
  if v_context is null then
    return;
  end if;

  -- Count DISTINCT vouches of this author, in this context, the viewer has
  -- now interacted with (any kind). Distinct vouches — not raw events — so
  -- five shares of one vouch is still just one.
  select count(distinct vi.vouch_id)
    into v_distinct
  from public.vouch_interactions vi
  where vi.viewer_id = v_viewer
    and vi.author_id = v_author
    and public.vouch_type_to_context(vi.vouch_type) = v_context;

  -- Promote to a trust context once at/over threshold AND there's an accepted
  -- follow viewer -> author (we only annotate real, accepted edges; a pending /
  -- blocked edge isn't a trusted relationship). array_append only when the
  -- context isn't already present, so this is idempotent.
  -- coalesce to '{}' so an accepted edge with a NULL trust_contexts still
  -- learns: `v_context = any(NULL)` is NULL, and `not NULL` is NULL, which
  -- would silently exclude the row and never promote.
  if v_distinct >= 2 then
    update public.follows f
       set trust_contexts = array_append(coalesce(f.trust_contexts, '{}'), v_context)
     where f.follower_id = v_viewer
       and f.followed_id = v_author
       and f.status = 'accepted'
       and not (v_context = any (coalesce(f.trust_contexts, '{}')));
  end if;
end;
$$;

grant execute on function public.record_vouch_interaction(uuid, text) to authenticated;

notify pgrst, 'reload schema';
