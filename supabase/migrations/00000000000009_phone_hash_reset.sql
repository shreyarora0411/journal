-- Migration 9 — clear all phone_hash values.
--
-- Reason: until the new stamp-phone-hash edge function landed (Fix 1 of the
-- pre-pilot fix list), `useStartSession` wrote the *unpeppered* client-side
-- SHA-256 directly into users.phone_hash. The match-contacts function adds
-- the server pepper before lookup. The two hashes never collided —
-- contact matching has been silently broken since it was built.
--
-- Wipe every existing phone_hash and let users re-stamp on next sign-in
-- via the new edge function. Pilot users (us + the 20 testers) just need
-- to sign out and sign back in once after this migration lands.

update public.users
set phone_hash = null
where phone_hash is not null;

-- Sanity index check — nothing to add, the existing
-- users_phone_hash_idx covers post-rehash lookups.
