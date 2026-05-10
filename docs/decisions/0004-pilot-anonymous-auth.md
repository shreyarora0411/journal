# 0004 — Anonymous auth for pilot; OTP deferred

**Status:** Accepted (pilot only — revisit before TestFlight)
**Date:** 2026-05-10
**Supersedes (partially):** `docs/build-plan.md` §1.1, `CLAUDE.md` §2 ("Auth: Phone OTP via WhatsApp")

## Context

The build plan specifies phone OTP via WhatsApp (Twilio Verify) as the auth mechanism. For the 20-user pilot this is overkill: Twilio costs money, WhatsApp Verify needs sender-template approval that takes days, and the threat model is "20 friends I personally invited" — not random sign-ups.

What we still need from auth:
1. A stable session per device that survives app restarts.
2. A phone number tied to the user (hashed) so the contact-matching flow works.

We do **not** need at this stage:
- Identity proof (no one is impersonating anyone in a 20-friend pilot).
- Cross-device account recovery (a reinstall = a new account; we'll re-onboard manually).

## Decision

Switch to Supabase **anonymous auth** for the pilot.

- The phone screen captures a phone number, normalizes it, calls `supabase.auth.signInAnonymously()` to create a session, then stamps `users.phone_hash` on the freshly-created `public.users` row.
- The phone is no longer an auth credential — it lives in `users.phone_hash` purely for contact matching.
- The six-screen onboarding count is preserved; only the OTP sub-stage of the phone screen is removed.

The original Twilio Verify integration (`auth.sms.twilio` block in `supabase/config.toml`, `useSignInWithPhone` / `useVerifyOtp` hooks) is removed; we'll re-introduce a refined version before TestFlight.

## Operational note

Supabase has anonymous sign-ins **off by default**. To enable: Supabase dashboard → Authentication → Providers → toggle "Anonymous Sign-Ins". Without this, the app surfaces a generic "Could not start a session" error.

## Consequences

- Faster, friction-free onboarding for pilot users; no Twilio account or sender template required.
- No identity proof: any user can claim any phone number for contact-matching purposes. Acceptable for a 20-friend pilot; **must** be revisited before TestFlight (Phase 5) or any wider distribution.
- A reinstall creates a new account because there is no recoverable credential. Pilot users are warned of this; we'll re-onboard them manually if it happens.
- `auth.users.phone` is `NULL` for every account in this pilot — downstream code must read phone via `users.phone_hash` (already the case in `match-contacts`).
- A future migration to OTP-backed accounts will need a one-time "claim your account" flow that links a verified phone number to an existing anonymous user. Out of scope for v0.
