# supabase — schema, RLS, functions

Backend for `journal`. Postgres + Auth + Storage + Edge Functions. The migrations here are the **source of truth** for data shape; [`docs/data-model.md`](../docs/data-model.md) explains the why and [`docs/architecture.md`](../docs/architecture.md) the RLS patterns. Root [`CLAUDE.md`](../CLAUDE.md) §5–§6 governs.

---

## Migrations (`migrations/`, numbered, append-only)

**Never edit a committed migration** (root §13). Add a new numbered file. Every table: `id uuid` PK, `created_at`/`updated_at` (via `set_updated_at()` trigger), and `deleted_at` for soft delete — reads filter `deleted_at IS NULL`. Enum-shaped columns use Postgres enum types.

Evolution (chronological highlights):

| # | Adds |
|---|---|
| 00 | `pgcrypto`, `citext` extensions |
| 01 | `users` (extends `auth.users`); `handle_new_user()`, `set_updated_at()` triggers |
| 02 | `onboarding_completed_at`; `contact_matches` (service-role writes, owner reads) |
| 03 | Trip graph: `trips`, `cities`, `venues`, `areas`, `tips`, `trip_photos`, `extraction_runs`, `extracted_entities` + enums; owner-only RLS |
| 04 | `follows`; `mv_friends_of_friends`; `is_visible_to()`, `search_friend_graph()`; widens trip RLS to visibility |
| 05 | `destinations`, `lists`, `list_items`, `wishlist_items`, `activity`; `canonical_places` view |
| 06 | `avatars` storage bucket (public read, owner write) |
| 07 | `users` home-city + lat/lng ([ADR 0009](../docs/decisions/0009-location-first-trip-clustering.md)) |
| 08 | `tips.verdict`, `tip_uses` |
| 09 | one-time `phone_hash` reset |
| 10 | tighten `users` RLS; `me()`, `public_profiles` view |
| 11 | `search_friend_graph()` uses `auth.uid()` |
| 12 | `me_stats()` RPC |
| 13 | `verdicts` table + `verdict_counts()`, `trip_with_verdict_counts` view |
| 14 | one-time activity cleanup |
| 15 | `cities.google_place_id` + `place_types`; curated photos |
| 16 | plaintext `phone_e164` + `get_phone_for_friend()` |
| 17 | wishlist nesting (parent/child, notes) |
| 20–24 | canonical geography ([ADR 0011](../docs/decisions/0011-geographic-hierarchy.md)): `countries`; rename `places`→`cities`; `cities.country_id` FK + backfill; drop legacy text column; rebuild all RPCs/views |
| 30 | polymorphic `list_items` (`target_type`/`target_id` enum, unique index) alongside legacy columns |
| 31–33, 35 | atomic logs: venues first-class; `resolve_google_place()` + `insert_atomic_log()`; venue cover photo; `me_stats()` counts atomic logs |

> **Renames to respect:** `places` → `cities`. When touching a function/view that referenced `places`, follow the migration-24 rebuild pattern.

---

## RLS & visibility

- **Default deny; owner-only** on user-owned tables (`trips`, `cities`, `venues`, `areas`, `tips`, `extracted_entities`, `contact_matches`, `verdicts`, `users`).
- **Broadcast reads** go through `is_visible_to(viewer, owner, visibility)` against the follows graph + `mv_friends_of_friends` (materialized — refreshed on follow/unfollow, **not** a per-read recursive CTE). Levels: followers / friends_of_friends / everyone.
- **Search & feed filter at the child level**, not the trip level — a user may match a venue in a trip they can otherwise only partially see (root §6).
- **Verdicts** are owner-only rows; only aggregate counts (`verdict_counts`, `trip_with_verdict_counts`) are exposed — never per-user attribution.
- Policies live in the same migration as the table. New table → RLS in the same file, or it ships closed.

### RPCs & views (current)
`search_friend_graph`, `is_visible_to`, `me`, `me_stats`, `verdict_counts`, `resolve_google_place`, `insert_atomic_log`, `get_phone_for_friend`, `refresh_mv_friends_of_friends`, `gen_user_handle`, `handle_new_user`, `set_updated_at`. Views: `canonical_places`, `public_profiles`, `trip_with_verdict_counts`, `mv_friends_of_friends`.

---

## Edge functions (`functions/`, Deno)

| Function | Does |
|---|---|
| `extract-entities` | POST `{ trip_id }` → Claude (system prompt from `@journal/shared` extractors, model via `ANTHROPIC_MODEL`) → writes venue/area/tip proposals to `extracted_entities` |
| `match-contacts` | Client uploads SHA-256 hashed phones → server re-hashes **with pepper** → matches `users.phone_hash` → writes `contact_matches`, returns only the caller's matches |
| `stamp-phone-hash` | Client posts client-hash (+ optional E.164) → server applies the **same pepper** → updates `users.phone_hash` / `phone_e164` |
| `_shared/cors.ts` | Shared CORS headers + preflight |

> **Pepper symmetry is load-bearing:** `match-contacts` and `stamp-phone-hash` must apply the identical server pepper, or matching fails silently. Raw phone numbers never leave `auth.users`/edge functions (root §9). Import phone normalization from `@journal/shared`, not a local copy.

---

## Local workflow

- `pnpm db:start` / `db:stop`; `pnpm db:reset` (drop → migrate → seed via `seed.sql`).
- After any schema change: `pnpm db:reset`, then `pnpm types:gen` (regenerates `packages/shared/src/types/db.ts`), then update Zod schemas in `@journal/shared`.
- `config.toml` = local project config (`project_id: journal`, Postgres 15, 50MiB uploads, SMS signup on / email off, edge oneshot). Secrets (Anthropic key, phone pepper, Google key) come from the environment, never committed.
