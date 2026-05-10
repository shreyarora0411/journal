# Data model

Authoritative reference for table shapes. The migrations in `supabase/migrations/` are the source of truth; this file explains the why.

See `CLAUDE.md` §5 for the conceptual overview. This document covers nuance and gotchas.

## Conventions

- Every table has `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
- Every table has `deleted_at timestamptz` for soft delete. Hard purge runs on a schedule after 30 days.
- Foreign keys are `on delete cascade` for parent/child relationships (e.g. trip → places), `on delete restrict` for user references unless a soft-delete cascade is intentional.
- Enum-shaped columns use Postgres enum types, not text + check.
- All `_id` columns are uuid. Avoid surrogate integer keys.

## Phase 0 scope

Only `users` exists at the end of Phase 0. The rest of this document describes the shape we will build in Phase 2.

### `users`

Extends `auth.users` 1:1. Application-level profile fields live here.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK to `auth.users.id`. |
| `handle` | citext unique | Set during onboarding. Lowercase, 3–24 chars, `[a-z0-9_]`. |
| `display_name` | text | What appears in the UI. |
| `avatar_url` | text nullable | Storage path. |
| `phone_hash` | bytea | SHA-256(phone || server_pepper). Indexed for matching. |
| `default_visibility` | enum (`followers`, `friends_of_friends`, `everyone`) | Default `friends_of_friends`. |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | Standard. |

A row is created via a `handle_new_user()` trigger on `auth.users` insert.

## Phase 2+ tables

(Full schemas in `supabase/migrations/` once Phase 2 begins.)

- `trips`, `places`, `venues`, `areas`, `tips`, `trip_photos`
- `follows`, `contact_matches`, `mv_friends_of_friends`
- `extraction_runs`, `extracted_entities`

## Visibility

Per-trip column. Cascades to children at read time via `is_visible_to(viewer, trip)`. See `architecture.md` for the function and the materialised view it depends on.

## Soft delete

`deleted_at IS NULL` is the read filter, applied at the RLS-policy level for select and at the application level for query joins. A scheduled job in `supabase/functions/purge-soft-deleted` runs nightly and hard-deletes rows older than 30 days.

## Indexes

To be added per-feature as queries appear. The starter set:

- `users.phone_hash` — btree, for contact matching.
- `users.handle` — unique btree (already implicit).
- `follows (follower_id, followed_id)` — unique. Both directions get indexed.
