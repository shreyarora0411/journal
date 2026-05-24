-- Migration 10 — tighten users RLS (Fix 2 of the pre-pilot list).
--
-- Bug:
--   The `users_authenticated_read` policy let any authenticated user
--   SELECT * from public.users. That exposed phone_hash,
--   default_visibility, bio, favourite_four_trip_ids, is_creator, and
--   onboarding_completed_at to anyone with a session.
--
-- Fix:
--   1. Drop the blanket read policy.
--   2. Revoke broad table-level SELECT from `authenticated`.
--   3. Grant SELECT only on the safe columns
--      (id, handle, display_name, avatar_url, bio, is_creator).
--   4. Add `me()` — a SECURITY DEFINER function that returns the caller's
--      full row. Use this for self-reads that need the full surface.
--   5. Add `public_profiles` — a SECURITY INVOKER view that projects the
--      safe columns. Use this for cross-user joins.
--
-- Tests: see Fix 2.5 in the pre-pilot brief — selecting phone_hash
-- cross-user should return `permission denied for column "phone_hash"`.

drop policy if exists users_authenticated_read on public.users;

-- Column-level grant: authenticated users can SELECT only the safe columns.
revoke select on public.users from authenticated;
grant select (id, handle, display_name, avatar_url, bio, is_creator)
  on public.users to authenticated;

-- Row-level: rows are readable when not soft-deleted.
create policy users_safe_cols_read on public.users for select
  to authenticated
  using (deleted_at is null);

-- Owner self-read with all columns: via a security-definer function.
-- Bypasses the column grant because the function runs as definer (the
-- migration runner, which has implicit full select), then returns the row.
create or replace function public.me()
returns public.users
language sql
stable
security definer
set search_path = public
as $$
  select * from public.users where id = auth.uid() and deleted_at is null;
$$;

grant execute on function public.me() to authenticated;

-- Cross-user convenience view. SECURITY INVOKER keeps the underlying
-- table RLS active (so deleted rows stay hidden even if a policy slips).
create or replace view public.public_profiles
  with (security_invoker = true)
as
  select id, handle, display_name, avatar_url, bio, is_creator
  from public.users
  where deleted_at is null;

grant select on public.public_profiles to authenticated;
