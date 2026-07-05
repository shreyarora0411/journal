-- Migration 63 — close the PUBLIC-pseudo-role EXECUTE leak that migration
-- 61's per-role revoke loop missed, plus a relationship-status gap found
-- while verifying it.
--
-- ROOT CAUSE: `CREATE FUNCTION` grants EXECUTE to the pseudo-role PUBLIC by
-- default. Migration 61 ran `revoke execute on function %s from anon` in a
-- loop over every public function — a per-ROLE revoke. That does nothing to
-- the separate PUBLIC grant: every role (anon and authenticated alike) is
-- implicitly a member of PUBLIC, so `anon`/`authenticated` still executed
-- these functions via that untouched blanket grant. Confirmed live via
-- pg_proc.proacl showing a bare `=X/postgres` entry (the empty-role-name
-- entry is PUBLIC) on every trust-era SECURITY DEFINER function. This is
-- exactly the bug the security advisor's anon_security_definer_function_
-- executable / authenticated_security_definer_function_executable warnings
-- were still flagging after mig 61. Migration 60 shows the correct pattern
-- (`revoke ... from public, anon; grant ... to authenticated;`) — it just
-- wasn't applied to the older, pre-existing functions.
--
-- Scope: every SECURITY DEFINER function in public with a live PUBLIC grant
-- (has_public_grant=1 via pg_proc.proacl, verified 2026-07-05):
--   handle_new_user, refresh_mv_friends_of_friends, is_visible_to, me,
--   get_phone_for_friend, get_vouch_uses, resolve_vouch_place.
-- (place_axes, place_tag_shares, taste_match, recommend_places,
--  my_taste_axes, my_taste_tags, find_or_create_place, taste_twins,
--  place_lovers, user_loved_places, user_love_count, user_taste_axes,
--  user_taste_tags, is_blocked_pair, clamp_axis, axes_cosine,
--  tags_weighted_jaccard already carry no PUBLIC grant — mig 55/57/58/59/60
--  already scoped these correctly. Not touched here.)
--
-- Per-function disposition (verified before writing this, not guessed):
--   handle_new_user()                — fires via trigger on_auth_user_created
--                                       on auth.users (pg_trigger, confirmed
--                                       live). Trigger execution does not
--                                       check the invoking role's EXECUTE
--                                       privilege on the function at all, so
--                                       no client role needs direct access.
--                                       Revoke from public/anon/authenticated,
--                                       grant to nobody.
--   refresh_mv_friends_of_friends()   — fires via trigger follows_refresh_mv
--                                       on public.follows (confirmed live).
--                                       Same as above: trigger-only, no
--                                       direct grant to anyone.
--   is_visible_to(uuid,uuid,visibility) — NOT called directly by the client
--                                       (grep apps/mobile/src: no
--                                       `.rpc('is_visible_to'` anywhere), but
--                                       it IS referenced directly inside the
--                                       `qual` of 10 live RLS policies
--                                       (trips, tips, trip_photos, lists,
--                                       list_items, venues, areas, cities,
--                                       vouches, vouch_list_items — confirmed
--                                       via pg_policies). RLS-qual function
--                                       calls are checked against the
--                                       QUERYING role, not the table owner,
--                                       so `authenticated` MUST keep direct
--                                       EXECUTE here or every read on those
--                                       10 tables breaks. Revoke from
--                                       public/anon only; keep authenticated.
--   me()                              — called directly by the client
--                                       (`.rpc('me')`). Revoke from
--                                       public/anon; keep authenticated.
--   get_phone_for_friend(uuid)        — called directly by the client.
--                                       Sensitive (raw phone number).
--                                       Verified its body gates on a
--                                       `follows` row existing in either
--                                       direction — but NOT on `status`, so
--                                       a `blocked` row (the opposite of
--                                       intended) or a merely `pending`
--                                       (not yet accepted) request would
--                                       still satisfy the EXISTS check and
--                                       leak the number. No live row is
--                                       currently blocked/pending (all 10
--                                       are accepted), so this hasn't been
--                                       exploited, but it's a real latent
--                                       gap directly in the function this
--                                       migration was asked to scrutinize —
--                                       fixed below via create-or-replace
--                                       (never drop — see mig 55 §10 note on
--                                       default-grant reset), re-adding
--                                       `and status = 'accepted'` to both
--                                       EXISTS clauses. Revoke from
--                                       public/anon; keep authenticated.
--   get_vouch_uses()                  — called directly by the client. Body
--                                       already scopes to `vch.user_id =
--                                       auth.uid()` — no relationship gate
--                                       needed, it only ever reads the
--                                       caller's own vouches. Revoke from
--                                       public/anon; keep authenticated.
--   resolve_vouch_place(...)          — called directly by the client. Body
--                                       already scopes its UPDATE to
--                                       `user_id = auth.uid()`. Revoke from
--                                       public/anon; keep authenticated.

-- Tighten get_phone_for_friend's gating (create-or-replace only).
create or replace function public.get_phone_for_friend(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select phone_e164 from public.users
  where id = target_user_id
    and deleted_at is null
    and phone_e164 is not null
    and (
      exists (
        select 1 from public.follows
        where follower_id = auth.uid() and followed_id = target_user_id
          and status = 'accepted'
      )
      or exists (
        select 1 from public.follows
        where follower_id = target_user_id and followed_id = auth.uid()
          and status = 'accepted'
      )
    );
$$;

-- Trigger-only functions: no client role should ever call these directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.refresh_mv_friends_of_friends() from public, anon, authenticated;

-- RLS-qual helper: authenticated needs it (10 policies depend on it); anon
-- and the PUBLIC blanket grant do not.
revoke execute on function public.is_visible_to(uuid, uuid, visibility) from public, anon;
grant execute on function public.is_visible_to(uuid, uuid, visibility) to authenticated;

-- Client-callable RPCs: close PUBLIC/anon, keep authenticated explicitly.
revoke execute on function public.me() from public, anon;
grant execute on function public.me() to authenticated;

revoke execute on function public.get_phone_for_friend(uuid) from public, anon;
grant execute on function public.get_phone_for_friend(uuid) to authenticated;

revoke execute on function public.get_vouch_uses() from public, anon;
grant execute on function public.get_vouch_uses() to authenticated;

revoke execute on function public.resolve_vouch_place(uuid, text, text, text, double precision, double precision) from public, anon;
grant execute on function public.resolve_vouch_place(uuid, text, text, text, double precision, double precision) to authenticated;

notify pgrst, 'reload schema';
