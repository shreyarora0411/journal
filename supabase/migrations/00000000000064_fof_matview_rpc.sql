-- Migration 64 — close the mv_friends_of_friends direct-read exposure.
--
-- Postgres materialized views cannot carry RLS (`ALTER MATERIALIZED VIEW
-- ... ENABLE ROW LEVEL SECURITY` is not supported). mv_friends_of_friends
-- (viewer_id, target_id) had `authenticated` SELECT (needed by two live
-- client features — see below) with viewer_id passed as a client-supplied
-- filter, not enforced server-side: any signed-in user could call
-- `/rest/v1/mv_friends_of_friends?viewer_id=eq.<anyone>` and read someone
-- else's friends-of-friends adjacency list. Confirmed via pg_class.relacl:
-- `authenticated=r/postgres` (SELECT-only, from mig 62's tightening pass —
-- that pass correctly closed TRUNCATE/DML but didn't know the two live
-- client reads existed, so it kept SELECT open rather than closing it).
--
-- Live client usage (grep-confirmed, both filter by their OWN viewer_id
-- read from the client's own auth session — the exact pattern that's
-- unenforceable without RLS):
--   apps/mobile/src/features/search/api/use-discover.ts (useDiscover —
--     friends-of-friends discovery, Tier 2)
--   apps/mobile/src/features/onboarding/api/use-matched-friends.ts
--     (useMatchedFriends — "Friends in common" onboarding badge)
--
-- Fix: wrap the viewer-scoped read in a SECURITY DEFINER RPC (same shape as
-- me()/is_visible_to() — see mig 4/40) that binds to auth.uid() itself, so
-- there is no client-suppliable viewer_id to spoof. Grant execute using the
-- mig-60 pattern (revoke from public+anon, not just anon — CREATE FUNCTION
-- default-grants EXECUTE to the PUBLIC pseudo-role, which a per-role revoke
-- from anon alone does not remove — see mig 63). Then revoke authenticated's
-- direct SELECT on the raw matview, since is_visible_to() (SECURITY
-- DEFINER, mig 40) already reads it internally under the function owner's
-- privileges — that internal read is unaffected by revoking the calling
-- role's direct table grant.

create or replace function public.my_friends_of_friends()
returns table (target_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select target_id from public.mv_friends_of_friends where viewer_id = auth.uid();
$$;

revoke execute on function public.my_friends_of_friends() from public, anon;
grant execute on function public.my_friends_of_friends() to authenticated;

-- No client reads the raw matview anymore once this migration's client-side
-- companion change lands — internal-only from here on.
revoke select on public.mv_friends_of_friends from authenticated;

notify pgrst, 'reload schema';
