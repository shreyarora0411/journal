# Accepted risks

A registry of security-posture items that have been reviewed and deliberately accepted. Future audits should not re-litigate these without new information; if circumstances change (new columns, new features, a policy becomes load-bearing in a new way), revisit the entry rather than the whole decision.

## 1. `public.destinations` INSERT policy `WITH CHECK (true)`

Accepted 2026-07-05. Any authenticated user can insert rows into `public.destinations` because it is a shared find-or-create lookup table with no owner column — the lists feature actively relies on clients inserting a destination the first time anyone references it. The worst case is junk rows (noise), not a privacy or data-exposure issue, since the table holds no user data.

## 2. Supabase advisor: `auth_allow_anonymous_sign_ins` warnings

Accepted 2026-07-05. The advisor flags RLS policies across many tables for being reachable by anonymous sign-ins. This is by design: the app uses Supabase anonymous auth as its primary sign-in (with phone-keyed recovery — see [ADR 0004](./decisions/0004-pilot-anonymous-auth.md)), and anonymous users hold the `authenticated` role, so "anonymous can access" is equivalent to "signed-in users can access" here. Disabling anonymous access would break every user.

## 3. Supabase advisor: `authenticated_security_definer_function_executable` warnings

Accepted 2026-07-05. The advisor flags SECURITY DEFINER functions executable by the `authenticated` role. This is by design: definer RPCs (`me()`, the taste-read functions, `my_friends_of_friends()`) are the app's privacy architecture — they exist precisely to return carefully-shaped cross-user data that raw RLS-governed table reads must not expose. Each definer function is scoped to `auth.uid()` internally; removing execute grants would remove core functionality, not add safety.

## 4. Orphaned `auth.users` rows after pilot data wipes

Accepted 2026-07-05. Pilot-era data wipes deleted rows from `public.users` (and product tables) without always deleting the corresponding `auth.users` entries, so orphaned auth rows may exist. `public.users` is the product's source of truth; an orphaned auth row carries no product data, grants no access to anything (all reads are keyed off `public.users` / RLS), and at worst is cleanup debt in the auth schema.
