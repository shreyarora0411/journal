-- Redesign slice 4 — sentiment + validation (ADR 0010).
-- Two additions:
--   1. `tips.verdict` — the private love/mid/skip bucket the logger
--      captures on the Log screen. Surfaces only on the logger's own
--      profile; never on the recommendation card the friend sees.
--   2. `tip_uses` — friend "used your tip" attribution. Drives the
--      Validation modal (#14) and the Wrapped "used by friends" stat
--      (#15). One row per (user_id, tip_id); idempotent.

-- 1. Verdict bucket on tips ------------------------------------------------

alter table public.tips
  add column if not exists verdict text;

alter table public.tips
  add constraint tips_verdict_values
  check (verdict is null or verdict in ('love', 'mid', 'skip'));

-- 2. Tip uses --------------------------------------------------------------

create table if not exists public.tip_uses (
  id uuid primary key default gen_random_uuid(),
  tip_id uuid not null references public.tips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz not null default now(),
  -- Optional free-text thank-you the using friend leaves the logger.
  thank_you text,
  -- Optional pointer to the trip where the tip was used.
  trip_id uuid references public.trips(id) on delete set null,
  unique (tip_id, user_id)
);

create index if not exists tip_uses_tip_id_idx on public.tip_uses(tip_id);
create index if not exists tip_uses_user_id_idx on public.tip_uses(user_id);

-- RLS — only the using friend or the original tip author can see a row.
-- (We expose two read paths because both Validation and Wrapped query
-- from different angles: "who used my tip" vs "which tips did I use".)
alter table public.tip_uses enable row level security;

create policy tip_uses_select_self
  on public.tip_uses
  for select
  using (
    auth.uid() = user_id
    or auth.uid() in (
      select t.user_id
      from public.trips t
      join public.tips tip on tip.parent_type = 'trip' and tip.parent_id = t.id
      where tip.id = tip_uses.tip_id
    )
  );

create policy tip_uses_insert_self
  on public.tip_uses
  for insert
  with check (auth.uid() = user_id);

create policy tip_uses_delete_self
  on public.tip_uses
  for delete
  using (auth.uid() = user_id);
