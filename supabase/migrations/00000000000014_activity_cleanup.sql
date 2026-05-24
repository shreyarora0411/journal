-- Migration 14 — one-time cleanup of test activity rows accumulated
-- during development. The Session-2 brief flagged 'Dkdjhdbdhd' and 'Test'
-- as obvious dev fixtures showing on the live activity surface.
--
-- Idempotent: re-running is a no-op once the offending rows are gone.

delete from public.activity
where payload::text ilike '%dkdjhdbdhd%'
   or payload::text ilike '%test%';
