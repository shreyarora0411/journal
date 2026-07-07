-- Migration 68 — place_interactions: implicit-signal capture (engine
-- groundwork, capture-only).
--
-- WHY: analytics events (log.event -> PostHog) are invisible to the taste
-- engine. Spotify's core lesson for small recommenders is that explicit
-- intent signals (saves, shares, "I actually went") out-rank passive ones —
-- but only if you've been logging them. This table records the signals NOW
-- so the ranking layers documented in docs/taste-engine-v2.md have history
-- to train on when user scale supports them. Nothing reads this table yet;
-- recommend_places is deliberately unchanged.
--
-- Deliberately NOT an extension of vouch_interactions: that table is
-- vouch-anchored and author-attributed ((viewer, author, vouch_id not
-- null)) — the wrong key for place-level signals with no author.

create table public.place_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Nullable only for signals with no place anchor (taste-card share).
  place_id uuid references public.canonical_places(id) on delete cascade,
  kind text not null check (kind in (
    'maps_opened',
    'place_shared',
    'taste_card_shared',
    'wishlist_add',
    'list_add'
  )),
  created_at timestamptz not null default now(),
  check (kind = 'taste_card_shared' or place_id is not null)
);

create index place_interactions_user_place_idx
  on public.place_interactions (user_id, place_id, created_at desc);

alter table public.place_interactions enable row level security;

-- Own-insert / own-select only. No update/delete: signals are an
-- append-only behavioral log, and nothing user-facing renders them.
create policy place_interactions_select_own on public.place_interactions
  for select using (auth.uid() = user_id);
create policy place_interactions_insert_own on public.place_interactions
  for insert with check (auth.uid() = user_id);

grant select, insert on public.place_interactions to authenticated;

notify pgrst, 'reload schema';
