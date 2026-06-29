-- Migration 48: DB backstop against duplicate accounts for a known phone.
--
-- The client (use-start-session.ts) now refuses to fall through to
-- signInAnonymously() when a phone is already recognized. This index is
-- the defense-in-depth layer: even if a buggy or stale client tries to
-- stamp a phone_hash that already exists, Postgres rejects it.
--
-- Partial (WHERE phone_hash is not null) because freshly-minted anonymous
-- users exist briefly before stamp-phone-hash runs, and any soft-deleted
-- or never-stamped rows legitimately carry a null phone_hash. We only
-- enforce uniqueness over the rows that actually claim a phone.

create unique index if not exists users_phone_hash_uq
  on public.users (phone_hash)
  where phone_hash is not null;

notify pgrst, 'reload schema';
