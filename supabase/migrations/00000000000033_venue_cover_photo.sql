-- Migration 33 — one cover photo per atomic log.
--
-- Stores a Supabase Storage path. Bucket reused: trip-photos. The
-- existing RLS on storage.objects only requires `<user_id>/...` as
-- the first path segment, so per-venue uploads under
-- `<user_id>/venues/<venue_id>/<photoid>.<ext>` satisfy the policy
-- without a new bucket.
--
-- Multi-photo carousel is a follow-up — venues.cover_photo_path is
-- a single nullable text column.

alter table public.venues
  add column if not exists cover_photo_path text;
