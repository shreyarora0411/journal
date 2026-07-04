-- Migration 62 — security-advisor cleanup on live Trail (2026-07-04).
--
-- Re-derived from a live `get_advisors(type: security)` call, not guessed from
-- the ticket. All 5 hypothesised findings were confirmed still present.
-- Verified against apps/mobile/src client code (grep) before touching
-- anything, per the "don't blindly apply a guessed fix" instruction. Idempotent;
-- append-only — does not edit migrations 00–61.
--
-- 1. ERROR security_definer_view: public.canonical_cities.
--    pg_get_viewdef confirms it's the trip-era view (cities/trips/countries,
--    migration 24 lineage, "formerly canonical_places"). grep confirms the only
--    client reference is apps/mobile/src/features/places/api/use-canonical-place.ts
--    (useCanonicalPlace), which is exported from features/places/index.ts but
--    is NOT imported by any screen or route (app/(tabs)/place/[id].tsx uses
--    PlaceRedesignedScreen, the taste-pivot place detail screen, not this hook).
--    Dead code on a legacy table family per CLAUDE.md §0 ("trips/venues/cities
--    are LEGACY"). Safe to flip to security_invoker — the view will now run
--    with the querying role's own RLS instead of the creator's bypass, and
--    since nothing live reads it, there is no behaviour to break.
alter view public.canonical_cities set (security_invoker = true);

-- 2. WARN function_search_path_mutable: public.set_updated_at, public.gen_user_handle.
--    Both are 0-arg functions (confirmed via pg_proc — no overloads). Pin
--    search_path so they can't be tricked by a session-local search_path change.
alter function public.set_updated_at() set search_path = public;
alter function public.gen_user_handle() set search_path = public;

-- 3. WARN rls_policy_always_true: public.destinations (destinations_authenticated_insert,
--    WITH CHECK (true)).
--    INVESTIGATED, DELIBERATELY NOT CHANGED. grep shows this table is actively
--    used (apps/mobile/src/features/lists/api/use-find-or-create-destination.ts,
--    wired into features/lists/screens/list-detail-screen.tsx — not legacy).
--    information_schema.columns shows destinations has NO owner column (id,
--    name, country, region, search_vec, created_at) — it's a shared
--    name-lookup table, same shape as `countries`, not a per-user resource.
--    There is no auth.uid() to bind a WITH CHECK to, and the find-or-create
--    pattern (select-by-name, insert-if-missing) requires any authenticated
--    user to be able to create a new shared row on first use. Guessing a
--    tightened check (e.g. name-shape constraints) risks breaking that flow
--    for a condition nobody asked for. No sentiment/PII flows through this
--    table — worst case of the current policy is spam/junk destination rows,
--    not a privacy leak. Left as an accepted, documented risk.

-- 4. WARN materialized_view_in_api: public.mv_friends_of_friends selectable by
--    anon/authenticated.
--    INVESTIGATED — the ticket's hypothesis ("expected: none") does NOT hold:
--    grep shows TWO live direct reads —
--      apps/mobile/src/features/search/api/use-discover.ts
--      apps/mobile/src/features/onboarding/api/use-matched-friends.ts
--    Both require an authenticated viewerId and filter `.eq('viewer_id', ...)`
--    client-side. Revoking authenticated SELECT (the literal ticket fix) would
--    break both features, so we do NOT do that.
--    What we DO fix, from pg_class.relacl on the live matview:
--      anon=arwdDxtm, authenticated=arwdDxtm  (full grants incl. TRUNCATE/
--      TRIGGER/REFERENCES/INSERT/UPDATE/DELETE — none of which the app uses;
--      DML on a matview always fails anyway, but TRUNCATE does NOT — it's a
--      real "any signed-in user can wipe everyone's FoF cache" DoS lever).
--    This is the exact gap migration 61 tried to close for every table
--    ("TRUNCATE ignores RLS... no client role needs it") but missed: its sweep
--    drove off information_schema.tables, which does not list materialized
--    views (pg_matviews is a separate catalog), so mv_friends_of_friends never
--    got swept. mv_friends_of_friends is the only relkind='m' object in
--    public, so this is a single, narrow, verified fix, not a guess.
--    The app's Supabase session is always anonymous-auth-or-better
--    (apps/mobile/src/features/auth/api/use-start-session.ts calls
--    signInAnonymously() before anything else touches the DB), so the raw
--    `anon` Postgres role is never used by a live client request — anon
--    SELECT here is pure dead exposure of the social graph to an unauthed
--    apikey-only caller. Revoked outright.
revoke all on public.mv_friends_of_friends from anon;
revoke insert, update, delete, truncate, trigger, references, maintain
  on public.mv_friends_of_friends from authenticated;
grant select on public.mv_friends_of_friends to authenticated;
-- NOT fixed here (out of scope for this cleanup, flagged separately): even
-- with only `authenticated` SELECT left, any signed-in user can pass an
-- arbitrary viewer_id to read someone else's FoF row, because Postgres
-- materialized views cannot carry RLS policies. Closing that requires
-- routing use-discover.ts/use-matched-friends.ts through a SECURITY DEFINER
-- RPC scoped to auth.uid() (the same pattern as is_visible_to()/me()),
-- which is a client-plus-DB change beyond an advisor-cleanup migration.

-- 5. WARN public_bucket_allows_listing: storage bucket `avatars`.
--    storage.buckets confirms `avatars` has public = true. For a public
--    bucket, object GET is served from the unauthenticated
--    /storage/v1/object/public/... path, which does not consult
--    storage.objects RLS at all — so the existing `avatars_public_read`
--    SELECT policy (USING bucket_id = 'avatars', no path scoping) contributes
--    nothing to normal reads and exists only to make the bucket LISTABLE
--    (enumerate every uploaded avatar) via the list/enumerate endpoints.
--    grep confirms the only client storage call against this bucket is
--    `.getPublicUrl()` in use-upload-avatar.ts (apps/mobile/src/features/auth/
--    api/use-upload-avatar.ts) — no `.list()` or `.download()` anywhere. Owner
--    write policies (avatars_owner_insert/update/delete, already scoped to
--    auth.uid() = the folder prefix) are untouched. Dropping the SELECT
--    policy removes listing capability while every existing read path keeps
--    working.
drop policy if exists avatars_public_read on storage.objects;

notify pgrst, 'reload schema';
