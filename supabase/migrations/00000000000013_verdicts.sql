-- Migration 13 — verdicts table + aggregation primitives.
--
-- Replaces the hardcoded "♥ N" counts on feed cards with a real
-- love/mid/skip table. Privacy posture (locked by the Session-2 brief):
-- aggregate counts are public to anyone who can see the target; individual
-- verdict rows are owner-only (no "Mira loved this" attribution surface
-- in this slice).
--
-- Note: this is independent of `tips.verdict` (added in migration 8 /
-- ADR 0010). That column is the logger's annotation on their own tip;
-- this table tracks any viewer's love/mid/skip on a trip / place / venue
-- they can see.

create type public.verdict_kind as enum ('love', 'mid', 'skip');
create type public.verdict_target as enum ('trip', 'place', 'venue');

create table public.verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  target_type public.verdict_target not null,
  target_id uuid not null,
  verdict public.verdict_kind not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One verdict per user per target. Re-pick = upsert, not insert.
create unique index verdicts_user_target_uq
  on public.verdicts (user_id, target_type, target_id);

create index verdicts_target_idx on public.verdicts (target_type, target_id);

alter table public.verdicts enable row level security;

-- Owner can do anything with their own verdicts.
create policy verdicts_owner_all on public.verdicts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Verdict rows themselves are owner-only. Public counts come from the
-- verdict_counts() function and the trip_with_verdict_counts view, both
-- of which expose aggregates without revealing individual votes.
create policy verdicts_self_read on public.verdicts
  for select
  using (auth.uid() = user_id);

create trigger verdicts_set_updated_at
  before update on public.verdicts
  for each row execute function public.set_updated_at();

-- ---- verdict_counts() -------------------------------------------------
-- Aggregate counts for a single target the caller is allowed to see.
-- security invoker so the caller-RLS sanity check inside the function
-- (via is_visible_to) is bound to the actual caller.

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
      when 'place' then exists (
        select 1 from public.places p
        join public.trips t on t.id = p.trip_id
        where p.id = target_id and t.deleted_at is null
          and public.is_visible_to(auth.uid(), t.user_id, t.visibility)
      )
      when 'venue' then exists (
        select 1 from public.venues v
        join public.places p on p.id = v.place_id
        join public.trips t on t.id = p.trip_id
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

-- ---- trip_with_verdict_counts view ------------------------------------
-- Pre-aggregated view for the feed. SECURITY INVOKER keeps RLS on the
-- underlying trips/verdicts active for the caller.

create or replace view public.trip_with_verdict_counts
  with (security_invoker = true)
as
  select
    t.*,
    coalesce(love.c, 0)::int as love_count
  from public.trips t
  left join lateral (
    select count(*) as c
    from public.verdicts v
    where v.target_type = 'trip' and v.target_id = t.id and v.verdict = 'love'
  ) love on true;

grant select on public.trip_with_verdict_counts to authenticated;
