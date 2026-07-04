-- Migration 61 — re-tighten public.users grants + revoke RLS-bypassing table
-- privileges (live-drift repair, 2026-07-04).
--
-- DRIFT FOUND on live Trail (information_schema.column_privileges) — the
-- live schema arrived via a squashed baseline, not the numbered migrations,
-- and kept stock "grant all" privileges:
--   * authenticated had SELECT on every users column except phone_hash —
--     including phone_e164, home_lat/lng, favourite_four_trip_ids,
--     default_visibility, onboarding_completed_at. Any signed-in user could
--     read every user's raw phone number. Contract: mig 10 grants SELECT on
--     exactly (id, handle, display_name, avatar_url, bio, is_creator);
--     mig 16 explicitly relies on phone_e164 NOT being in that grant.
--   * authenticated had table-wide UPDATE on users — including is_creator
--     (search-ranking boost) and phone_e164/phone_hash (recovery spoofing).
--   * authenticated AND anon held TRUNCATE / TRIGGER / REFERENCES on every
--     public table — the three privileges RLS cannot gate (TRUNCATE bypasses
--     RLS entirely; the anon key ships in the client bundle).
--
-- Self-reads use me() (mig 10); the only cross-user phone path is
-- get_phone_for_friend() (mig 16). Idempotent; append-only.

-- 1. SELECT: exactly the safe columns.
revoke select on public.users from anon, authenticated;
grant select (id, handle, display_name, avatar_url, bio, is_creator)
  on public.users to authenticated;

-- 2. UPDATE: only fields the owner may edit. RLS (users_owner_update)
--    scopes WHICH ROWS; this grant scopes WHICH FIELDS. Excluded on
--    purpose: is_creator, phone_e164, phone_hash, created_at,
--    updated_at (trigger-managed), deleted_at (account deletion must go
--    through a controlled path, not a bare column write).
revoke update on public.users from anon, authenticated;
grant update (handle, display_name, avatar_url, bio, default_visibility,
              home_city, home_lat, home_lng, home_country_code,
              onboarding_completed_at, favourite_four_trip_ids)
  on public.users to authenticated;

-- 3. The client never INSERTs or DELETEs users rows (creation is
--    server-side; deletion is soft via a controlled path). No RLS policies
--    exist for these commands anyway — this is defense in depth.
revoke insert, delete on public.users from anon, authenticated;

-- 4. Revoke the RLS-bypassing privileges everywhere. TRUNCATE ignores RLS;
--    TRIGGER/REFERENCES are schema-shaping powers no client role needs.
do $$
declare t record;
begin
  -- information_schema.tables covers views and materialized views too —
  -- pg_tables alone leaves their ACL bits behind.
  for t in select table_name from information_schema.tables where table_schema = 'public' loop
    execute format(
      'revoke truncate, trigger, references on table public.%I from anon, authenticated',
      t.table_name);
  end loop;
end $$;
-- NOTE: default privileges may still hand these to FUTURE tables — any
-- migration creating a table should re-assert, or fix default privileges.

-- 5. anon executes NO public functions. The app signs in anonymously first
--    (role becomes `authenticated`) — the anon role never legitimately
--    calls an RPC, and several SECURITY DEFINER functions were exposed
--    (incl. get_phone_for_friend and the matview-refresh trigger fn, a
--    free DoS lever). Trigger functions also leave the authenticated grant.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from anon', f.sig);
  end loop;
end $$;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.refresh_mv_friends_of_friends() from authenticated;

notify pgrst, 'reload schema';
