-- Phase 1.4 + 1.3: track onboarding completion; store hashed contact matches.

-- Track when a user finished onboarding. NULL means they're mid-flow.
alter table public.users
  add column onboarding_completed_at timestamptz;

-- Hashed contact matches discovered during onboarding (and on demand later).
-- (user_id) found a match for (matched_user_id) — directional but symmetric in practice;
-- we write both rows when a match is mutual to keep reads cheap.
create table public.contact_matches (
  user_id uuid not null references public.users (id) on delete cascade,
  matched_user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, matched_user_id),
  check (user_id <> matched_user_id)
);

create index contact_matches_user_idx on public.contact_matches (user_id);

alter table public.contact_matches enable row level security;

-- Owner-only reads. The match-contacts edge function uses the service role to
-- write rows; clients only ever see their own matches.
create policy contact_matches_owner_select
  on public.contact_matches for select
  using (auth.uid() = user_id);

-- No client-side inserts or updates. Edge function (service role) only.
-- Default deny via no-policy for insert/update/delete.
