# 0003 — Display name on framing screen; handle deferred

**Status:** Accepted
**Date:** 2026-05-10

## Context

The build plan in `docs/build-plan.md` lists six onboarding screens (phone, framing, instagram, import, friends, welcome) but is silent on where the user supplies their `display_name` (required for the feed and friend profiles) and `handle` (required for shareable profile URLs).

Adding a dedicated screen for either would push the count to seven and conflict with the spare aesthetic in the design brief. Splitting them across two screens is worse.

## Decision

- **`display_name` is captured on the framing screen (screen 2).** The framing copy sits above a single input. Continue is disabled until non-empty. This is the only data the user must provide beyond the phone number to land in the app.
- **`handle` stays nullable through v0.** It is only needed for shareable profile URLs (`/friend/[handle]`), which Phase 1 does not surface. When we need it (Phase 3 friend profiles), we generate `user_<8-char-random>` server-side at first read; users can change it in settings post-v0.
- **`onboarding_completed_at` is added to `public.users`** and stamped when the user clears the welcome screen. The auth gate routes incomplete users back into onboarding from wherever they left off.

## Consequences

- Framing screen has two jobs (frame the product, capture display name). Worth it — keeps screen count at 6 and avoids a screen whose only purpose is "what should we call you?".
- Profile URLs are unavailable until handles are populated. Acceptable for Phase 1 (no friend graph yet).
- A future "personal URL" feature (post-v0) can promote handle from nullable to required without a data migration — the column already exists.
