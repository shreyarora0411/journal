-- Migration 55 — the TASTE ENGINE (docs/taste-pivot-spec.md §2).
--
-- The pivot: tag PLACES lightly; a person's taste = the recency-weighted
-- average of the places they loved. No self-description, no user×place
-- collaborative filtering, no ML — five bipolar axes + two tag layers, all
-- computable in plain SQL at seed scale (~300 places, ~250 users).
--
-- Axis order is FIXED everywhere as arrays double precision[5]:
--   [1] substance_scene   (-1 substance … +1 scene)
--   [2] mellow_lively     (-1 mellow    … +1 lively)
--   [3] adventurous_trusty(-1 adventurous … +1 trusty)
--   [4] refined_unfussy   (-1 refined   … +1 unfussy)
--   [5] value_splurge     (-1 value     … +1 splurge)
--
-- PARITY CONTRACT: the math here mirrors packages/shared/src/taste.ts
-- (half-life 180d, skip weight -0.5, prior weight 2, match = 0.7·cos+0.3·jac,
-- confidence gate 8 loves, follow boost 1.3, support λ 0.15, tribe 0.35,
-- cross-user match uses LOVES-ONLY vectors). Change one side → change both.
--
-- PRIVACY MODEL (deliberate, load-bearing; hardened per adversarial review):
--   * place_reactions is OWN-ROW RLS only. 'fine' and 'skip' NEVER leave the
--     owner's rows in ANY form: tag votes are de-attributed (column-level
--     grant), and the cross-user match scalar is computed from LOVES-ONLY
--     vectors so skips/priors can't be probed out of it.
--   * 'loved' may be surfaced ATTRIBUTED ("Loved by Priya"), but ONLY through
--     recommend_places()-style definer functions — never by direct row reads.
--   * A 'blocked' follows edge (either direction) suppresses attribution and
--     match probing entirely (migration 40 convention).
--   * Vouch text served by definer functions re-applies is_visible_to().

-- ---------------------------------------------------------------------------
-- 1. canonical_places grows the taste-era columns (nullable, non-breaking).
--    hub/zone: NCR is polycentric — "area" = named hub chips, not GPS radius.
-- ---------------------------------------------------------------------------

alter table public.canonical_places add column if not exists category text;
alter table public.canonical_places add column if not exists hub text;
alter table public.canonical_places add column if not exists zone text;

create index if not exists canonical_places_zone_hub_idx
  on public.canonical_places (zone, hub);

-- ---------------------------------------------------------------------------
-- 2. Vocabulary tables (seeded by migration 56 from packages/shared/src/taste.ts).
-- ---------------------------------------------------------------------------

create table if not exists public.category_priors (
  category text primary key,
  axes double precision[] not null default '{0,0,0,0,0}',
  -- cardinality (not array_length) so '{}' is rejected, and no NULL elements:
  -- a malformed prior would otherwise silently pin axes via greatest/least.
  constraint category_priors_axes_len
    check (cardinality(axes) = 5 and array_position(axes, null) is null)
);

create table if not exists public.taste_tags (
  slug text primary key,
  kind text not null check (kind in ('format', 'occasion')),
  label text not null,
  -- Per-axis nudge applied by vote share; keyed by axis name for readability.
  axis_effects jsonb not null default '{}'::jsonb
);

alter table public.category_priors enable row level security;
alter table public.taste_tags enable row level security;

drop policy if exists category_priors_read on public.category_priors;
create policy category_priors_read on public.category_priors
  for select to authenticated using (true);

drop policy if exists taste_tags_read on public.taste_tags;
create policy taste_tags_read on public.taste_tags
  for select to authenticated using (true);

grant select on public.category_priors to authenticated;
grant select on public.taste_tags to authenticated;

-- ---------------------------------------------------------------------------
-- 3. place_tag_votes — the crowd's 2–3 optional taps at log time.
--    DE-ATTRIBUTED to other clients: tags are cast at log time, so exposing
--    user_id/created_at would let anyone cross-reference recommend_places and
--    infer private fine/skip reactions ("tagged but never surfaced as a
--    lover"). Clients may read ONLY (place_id, tag_slug) via a column-level
--    grant; attribution stays server-side in the definer aggregates.
-- ---------------------------------------------------------------------------

create table if not exists public.place_tag_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  place_id uuid not null references public.canonical_places (id) on delete cascade,
  tag_slug text not null references public.taste_tags (slug) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, place_id, tag_slug)
);

create index if not exists place_tag_votes_place_idx on public.place_tag_votes (place_id);

alter table public.place_tag_votes enable row level security;

drop policy if exists place_tag_votes_read on public.place_tag_votes;
create policy place_tag_votes_read on public.place_tag_votes
  for select to authenticated using (true);

drop policy if exists place_tag_votes_own_write on public.place_tag_votes;
create policy place_tag_votes_own_write on public.place_tag_votes
  for insert with check (user_id = auth.uid());

drop policy if exists place_tag_votes_own_delete on public.place_tag_votes;
create policy place_tag_votes_own_delete on public.place_tag_votes
  for delete using (user_id = auth.uid());

-- Column-level SELECT: place_id + tag_slug only. NO user_id, NO created_at.
revoke select on public.place_tag_votes from authenticated;
grant select (place_id, tag_slug) on public.place_tag_votes to authenticated;
grant insert, delete on public.place_tag_votes to authenticated;

-- ---------------------------------------------------------------------------
-- 4. place_reactions — the log's one-tap sentiment. PRIVATE (own-row only).
--    One row per (user, place); re-logging updates it.
-- ---------------------------------------------------------------------------

create table if not exists public.place_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  place_id uuid not null references public.canonical_places (id) on delete cascade,
  sentiment text not null check (sentiment in ('loved', 'fine', 'skip')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_id)
);

create index if not exists place_reactions_user_idx on public.place_reactions (user_id, updated_at desc);
create index if not exists place_reactions_place_loved_idx
  on public.place_reactions (place_id) where sentiment = 'loved';

alter table public.place_reactions enable row level security;

-- OWN-ROW ONLY. There is deliberately no cross-user read policy: 'loved' is
-- surfaced attributed ONLY via the definer functions below; fine/skip never.
drop policy if exists place_reactions_own_all on public.place_reactions;
create policy place_reactions_own_all on public.place_reactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.place_reactions to authenticated;

drop trigger if exists place_reactions_set_updated_at on public.place_reactions;
create trigger place_reactions_set_updated_at
  before update on public.place_reactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. user_taste_priors — the onboarding either/or taps (own-row, private).
-- ---------------------------------------------------------------------------

create table if not exists public.user_taste_priors (
  user_id uuid primary key references public.users (id) on delete cascade,
  axes double precision[] not null default '{0,0,0,0,0}',
  updated_at timestamptz not null default now(),
  constraint user_taste_priors_axes_len
    check (cardinality(axes) = 5 and array_position(axes, null) is null)
);

alter table public.user_taste_priors enable row level security;

drop policy if exists user_taste_priors_own_all on public.user_taste_priors;
create policy user_taste_priors_own_all on public.user_taste_priors
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.user_taste_priors to authenticated;

drop trigger if exists user_taste_priors_set_updated_at on public.user_taste_priors;
create trigger user_taste_priors_set_updated_at
  before update on public.user_taste_priors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Math helpers (mirror packages/shared/src/taste.ts). Owner-internal-ish:
--    harmless computations, but keep anon away.
-- ---------------------------------------------------------------------------

create or replace function public.clamp_axis(v double precision)
returns double precision language sql immutable set search_path = public
as $$ select greatest(-1.0, least(1.0, v)); $$;

create or replace function public.axes_cosine(a double precision[], b double precision[])
returns double precision language plpgsql immutable set search_path = public
as $$
declare
  dot double precision := 0; na double precision := 0; nb double precision := 0; i int;
begin
  for i in 1..5 loop
    dot := dot + a[i] * b[i];
    na := na + a[i] * a[i];
    nb := nb + b[i] * b[i];
  end loop;
  if na = 0 or nb = 0 then return 0; end if;
  return dot / (sqrt(na) * sqrt(nb));
end;
$$;

-- Weighted Jaccard over jsonb tag-weight objects {slug: weight}.
create or replace function public.tags_weighted_jaccard(a jsonb, b jsonb)
returns double precision language sql immutable set search_path = public
as $$
  with slugs as (
    select jsonb_object_keys(coalesce(a, '{}'::jsonb)) as slug
    union
    select jsonb_object_keys(coalesce(b, '{}'::jsonb))
  ),
  vals as (
    select
      coalesce((a ->> slug)::double precision, 0) as av,
      coalesce((b ->> slug)::double precision, 0) as bv
    from slugs
  )
  select case
    when coalesce(sum(greatest(av, bv)), 0) = 0 then 0
    else sum(least(av, bv)) / sum(greatest(av, bv))
  end
  from vals;
$$;

-- ---------------------------------------------------------------------------
-- 7. Place fingerprint = category prior + Σ (tag vote-share · axis effect).
--    SECURITY DEFINER: aggregates over de-attributed tag votes (the definer
--    needs user_id for distinct-voter counts; clients can't read it).
-- ---------------------------------------------------------------------------

create or replace function public.place_axes(p_place uuid)
returns double precision[] language plpgsql stable security definer set search_path = public
as $$
declare
  v_axes double precision[] := '{0,0,0,0,0}';
  v_total int;
  rec record;
  v_axis_names text[] := array['substance_scene','mellow_lively','adventurous_trusty','refined_unfussy','value_splurge'];
  i int;
begin
  select coalesce(cp2.axes, '{0,0,0,0,0}')
    into v_axes
  from public.canonical_places cp
  left join public.category_priors cp2 on cp2.category = cp.category
  where cp.id = p_place;
  if v_axes is null then v_axes := '{0,0,0,0,0}'; end if;

  select count(distinct user_id) into v_total
  from public.place_tag_votes where place_id = p_place;
  if v_total = 0 then return v_axes; end if;

  for rec in
    select t.axis_effects, count(distinct v.user_id)::double precision / v_total as share
    from public.place_tag_votes v
    join public.taste_tags t on t.slug = v.tag_slug
    where v.place_id = p_place
    group by t.slug, t.axis_effects
  loop
    for i in 1..5 loop
      v_axes[i] := v_axes[i]
        + coalesce((rec.axis_effects ->> v_axis_names[i])::double precision, 0) * rec.share;
    end loop;
  end loop;

  for i in 1..5 loop
    v_axes[i] := public.clamp_axis(v_axes[i]);
  end loop;
  return v_axes;
end;
$$;

-- Place tag profile {slug: share} — used for user tag profiles + occasion gating.
create or replace function public.place_tag_shares(p_place uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  with total as (
    select greatest(count(distinct user_id), 1)::double precision as n
    from public.place_tag_votes where place_id = p_place
  )
  select coalesce(
    jsonb_object_agg(tag_slug, voters / (select n from total)),
    '{}'::jsonb
  )
  from (
    select tag_slug, count(distinct user_id)::double precision as voters
    from public.place_tag_votes where place_id = p_place
    group by tag_slug
  ) s;
$$;

-- ---------------------------------------------------------------------------
-- 8. User vectors. SECURITY DEFINER: they read other users' PRIVATE reactions
--    to produce aggregates only — raw rows never leave. search_path pinned.
--
--    p_loves_only: the CROSS-USER path. Skips and onboarding priors are
--    private steering inputs; folding them into an externally-probeable
--    scalar would let an attacker recover them by steering their own vector
--    (adversarial-review finding). So taste_match uses loves-only vectors on
--    BOTH sides; the full vector (skips + priors) powers only self-views and
--    viewer-side ranking.
-- ---------------------------------------------------------------------------

create or replace function public.user_love_count(p_user uuid)
returns int language sql stable security definer set search_path = public
as $$
  select count(*)::int from public.place_reactions
  where user_id = p_user and sentiment = 'loved';
$$;

create or replace function public.user_taste_axes(p_user uuid, p_loves_only boolean default false)
returns double precision[] language plpgsql stable security definer set search_path = public
as $$
declare
  v_sum double precision[] := '{0,0,0,0,0}';
  v_total double precision := 0;
  v_prior double precision[];
  rec record;
  v_w double precision;
  v_place_axes double precision[];
  i int;
begin
  for rec in
    select place_id, sentiment,
           extract(epoch from (now() - updated_at)) / 86400.0 as age_days
    from public.place_reactions
    where user_id = p_user
      and (sentiment = 'loved' or (not p_loves_only and sentiment = 'skip'))
  loop
    v_w := case rec.sentiment when 'loved' then 1.0 else -0.5 end
           * power(2.0, -rec.age_days / 180.0);
    v_place_axes := public.place_axes(rec.place_id);
    for i in 1..5 loop
      v_sum[i] := v_sum[i] + v_w * v_place_axes[i];
    end loop;
    v_total := v_total + abs(v_w);
  end loop;

  if not p_loves_only then
    select axes into v_prior from public.user_taste_priors where user_id = p_user;
    if v_prior is not null then
      for i in 1..5 loop
        v_sum[i] := v_sum[i] + 2.0 * v_prior[i];
      end loop;
      v_total := v_total + 2.0;
    end if;
  end if;

  if v_total = 0 then return '{0,0,0,0,0}'; end if;
  for i in 1..5 loop
    v_sum[i] := public.clamp_axis(v_sum[i] / v_total);
  end loop;
  return v_sum;
end;
$$;

-- Tag profile of a user = Σ over their LOVED places of the place's tag shares.
create or replace function public.user_taste_tags(p_user uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  with loved as (
    select place_id from public.place_reactions
    where user_id = p_user and sentiment = 'loved'
  ),
  pairs as (
    select key as slug, value::text::double precision as share
    from loved, lateral jsonb_each(public.place_tag_shares(loved.place_id))
  )
  select coalesce(jsonb_object_agg(slug, total), '{}'::jsonb)
  from (select slug, sum(share) as total from pairs group by slug) s;
$$;

-- True when a blocked follows edge exists in either direction (mig 40
-- convention: a block confers no visibility, no probing).
create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.follows f
    where f.status = 'blocked'
      and ((f.follower_id = a and f.followed_id = b)
        or (f.follower_id = b and f.followed_id = a))
  );
$$;

-- Person↔person match (0..1, 2dp), or NULL below the confidence gate (8 loves
-- each), or NULL for a blocked pair. LOVES-ONLY on both sides (see §8 note).
create or replace function public.taste_match(p_other uuid)
returns double precision language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_raw double precision;
begin
  if v_me is null or p_other is null or v_me = p_other then return null; end if;
  if public.is_blocked_pair(v_me, p_other) then return null; end if;
  if public.user_love_count(v_me) < 8 or public.user_love_count(p_other) < 8 then
    return null;
  end if;
  v_raw := 0.7 * public.axes_cosine(
             public.user_taste_axes(v_me, true),
             public.user_taste_axes(p_other, true))
         + 0.3 * public.tags_weighted_jaccard(
             public.user_taste_tags(v_me),
             public.user_taste_tags(p_other));
  return round(greatest(0.0, least(1.0, v_raw))::numeric, 2);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. The recommender. SECURITY DEFINER: joins other users' LOVED reactions
--    (attributed — that IS the product surface) but never exposes fine/skip.
--    Query = {zone, hub, occasion}; honest tiering, labeled BY THE LOVER THAT
--    CARRIES THE RANK (argmax), never bool_or:
--      'taste'   — top-weighted lover is a gated taste match
--      'follows' — top-weighted lover is someone you follow (no usable match)
--      'tribe'   — neither; love-recency only, weight 0.35 (labeled fallback)
-- ---------------------------------------------------------------------------

create or replace function public.recommend_places(
  p_zone text default null,
  p_hub text default null,
  p_occasion text default null,
  p_limit int default 30
)
returns table (
  place_id uuid,
  name text,
  hub text,
  zone text,
  google_place_id text,
  lat double precision,
  lng double precision,
  score double precision,
  tier text,
  top_lovers jsonb
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null then return; end if;

  -- Occasion must be a real occasion tag (never a format tag as a filter).
  if p_occasion is not null and not exists (
    select 1 from public.taste_tags tt where tt.slug = p_occasion and tt.kind = 'occasion'
  ) then
    return;
  end if;

  return query
  with lovers as (
    -- Other users' LOVED reactions on candidate places. fine/skip never enter;
    -- blocked pairs (either direction) are suppressed entirely.
    select r.place_id as pid, r.user_id as uid,
           extract(epoch from (now() - r.updated_at)) / 86400.0 as age_days
    from public.place_reactions r
    join public.canonical_places cp on cp.id = r.place_id
    where r.sentiment = 'loved'
      and r.user_id <> v_viewer
      and not public.is_blocked_pair(v_viewer, r.user_id)
      and (p_zone is null or cp.zone = p_zone)
      and (p_hub is null or cp.hub = p_hub)
      and (p_occasion is null or exists (
        select 1 from public.place_tag_votes tv
        where tv.place_id = r.place_id and tv.tag_slug = p_occasion
      ))
  ),
  lover_match as (
    -- Each lover's match computed ONCE (taste_match handles gates + blocks).
    select lp.uid,
           public.taste_match(lp.uid) as match,
           exists (
             select 1 from public.follows f
             where f.follower_id = v_viewer and f.followed_id = lp.uid
               and f.status = 'accepted'
           ) as followed
    from (select distinct l.uid from lovers l) lp
  ),
  weighted as (
    select l.pid, l.uid, lm.match, lm.followed,
           coalesce(lm.match, 0.35)
             * power(2.0, -l.age_days / 180.0)
             * case when lm.followed then 1.3 else 1.0 end as weight
    from lovers l
    join lover_match lm on lm.uid = l.uid
  ),
  scored as (
    select w.pid,
           max(w.weight)
             + 0.15 * ln(1 + greatest(sum(w.weight) - max(w.weight), 0)) as place_score,
           -- Tier = the ARGMAX lover's kind, so the label always agrees with
           -- whatever actually carries the rank.
           (array_agg(
              case
                when w.match is not null then 'taste'
                when w.followed then 'follows'
                else 'tribe'
              end
              order by w.weight desc
            ))[1] as place_tier
    from weighted w
    group by w.pid
  ),
  ranked_lovers as (
    select ww.pid, ww.uid, ww.match, ww.followed, ww.weight,
           row_number() over (partition by ww.pid order by ww.weight desc) as rn
    from weighted ww
  ),
  lover_json as (
    select rl.pid,
           jsonb_agg(
             jsonb_build_object(
               'user_id', u.id,
               'display_name', u.display_name,
               'handle', u.handle,
               'avatar_url', u.avatar_url,
               'match', rl.match,
               'followed', rl.followed,
               -- The lover's voiced note, re-gated by the SAME visibility rule
               -- the invoker path uses (definer must not bypass mig 38/40).
               'note', (
                 select vch.text from public.vouches vch
                 where vch.user_id = rl.uid and vch.place_id = rl.pid
                   and vch.deleted_at is null
                   and public.is_visible_to(v_viewer, vch.user_id, vch.visibility)
                 order by vch.created_at desc limit 1
               )
             ) order by rl.weight desc
           ) filter (where rl.rn <= 3) as lovers
    from ranked_lovers rl
    join public.users u on u.id = rl.uid
    group by rl.pid
  )
  select s.pid, cp.name, cp.hub, cp.zone, cp.google_place_id, cp.lat, cp.lng,
         s.place_score, s.place_tier, coalesce(lj.lovers, '[]'::jsonb)
  from scored s
  join public.canonical_places cp on cp.id = s.pid
  left join lover_json lj on lj.pid = s.pid
  order by s.place_score desc
  limit p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Self-only wrappers + execute-grant lockdown.
--     NOTE: replace these functions ONLY via create-or-replace. A drop-and-
--     recreate re-applies Supabase's default EXECUTE grants to anon/
--     authenticated and would undo the revokes below.
-- ---------------------------------------------------------------------------

create or replace function public.my_taste_axes()
returns double precision[] language sql stable security definer set search_path = public
as $$ select public.user_taste_axes(auth.uid(), false); $$;

create or replace function public.my_taste_tags()
returns jsonb language sql stable security definer set search_path = public
as $$ select public.user_taste_tags(auth.uid()); $$;

-- Owner-internal (definer functions run as owner, so they can still call
-- these; clients cannot):
revoke execute on function public.user_love_count(uuid) from public, anon, authenticated;
revoke execute on function public.user_taste_axes(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.user_taste_tags(uuid) from public, anon, authenticated;
revoke execute on function public.is_blocked_pair(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.place_tag_shares(uuid) from public, anon;
revoke execute on function public.place_axes(uuid) from public, anon;
revoke execute on function public.clamp_axis(double precision) from public, anon;
revoke execute on function public.axes_cosine(double precision[], double precision[]) from public, anon;
revoke execute on function public.tags_weighted_jaccard(jsonb, jsonb) from public, anon;
-- Client-callable surface:
revoke execute on function public.taste_match(uuid) from public, anon;
revoke execute on function public.recommend_places(text, text, text, int) from public, anon;
revoke execute on function public.my_taste_axes() from public, anon;
revoke execute on function public.my_taste_tags() from public, anon;
grant execute on function public.taste_match(uuid) to authenticated;
grant execute on function public.recommend_places(text, text, text, int) to authenticated;
grant execute on function public.my_taste_axes() to authenticated;
grant execute on function public.my_taste_tags() to authenticated;
grant execute on function public.place_axes(uuid) to authenticated;
grant execute on function public.place_tag_shares(uuid) to authenticated;

notify pgrst, 'reload schema';
