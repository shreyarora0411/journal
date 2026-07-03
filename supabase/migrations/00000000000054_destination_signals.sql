-- Migration 54 — destination_signals: viewer-PRIVATE, in-app travel-CONSIDERATION
-- signal. The honest answer to "how do you know someone is going anywhere": we
-- don't, and we won't fabricate a date. But a user searching their circle for a
-- destination is real, revealed forward interest (Gollwitzer: behaviour > stated
-- intent). Today that query is thrown away — it lives only in React state. This
-- captures it (and ONLY it) as the user's OWN private signal, so the app can
-- honestly resurface "the place you were looking at" without ever broadcasting
-- one user's consideration to their circle or inventing "going in March".
--
-- Guardrails (baked into the schema, not left to the client):
--   * Strictly viewer-private — own-row RLS, mirrors vouch_interactions (mig 51).
--     There is deliberately NO cross-user read policy and NO aggregate/trending
--     view; a "who's researching where" board would re-introduce the popularity
--     dynamics the thesis bans.
--   * Decaying (last_searched_at) and user-clearable (own delete).
--   * 'ask' and 'save' interest already live in recommendation_requests and
--     vouch_interactions — derive those by join; do NOT duplicate them here.

create table if not exists public.destination_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  destination_text text not null,
  norm_destination text not null,
  search_count integer not null default 1,
  first_searched_at timestamptz not null default now(),
  last_searched_at timestamptz not null default now(),
  unique (user_id, norm_destination)
);

create index if not exists destination_signals_user_recent_idx
  on public.destination_signals (user_id, last_searched_at desc);

alter table public.destination_signals enable row level security;

-- Own-row only: a user may read/write/clear ONLY their own consideration log.
drop policy if exists destination_signals_own_all on public.destination_signals;
create policy destination_signals_own_all on public.destination_signals
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.destination_signals to authenticated;

-- Atomic upsert + increment. security INVOKER so the own-row RLS above applies
-- (the function inserts with user_id = auth.uid()). Normalises the destination
-- with norm_search (mig 46) so "Bangkok" and "Bangkok, Thailand" collapse.
create or replace function public.record_destination_search(p_destination text)
returns void
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_norm text;
begin
  if v_user is null then return; end if;
  if coalesce(trim(p_destination), '') = '' then return; end if;
  v_norm := public.norm_search(p_destination);
  if length(v_norm) < 2 then return; end if;

  insert into public.destination_signals (user_id, destination_text, norm_destination)
  values (v_user, trim(p_destination), v_norm)
  on conflict (user_id, norm_destination)
  do update set
    search_count = destination_signals.search_count + 1,
    last_searched_at = now(),
    destination_text = excluded.destination_text;
end;
$$;

grant execute on function public.record_destination_search(text) to authenticated;

notify pgrst, 'reload schema';
