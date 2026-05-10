# 0005 — Defer Instagram OAuth for pilot

**Status:** Accepted (pilot only — revisit before TestFlight)
**Date:** 2026-05-11
**Supersedes (partially):** `docs/build-plan.md` §4.2

## Context

The build plan calls for Instagram import via the Basic Display API in Phase 4. Meta deprecated Basic Display in late 2024; the replacement (Instagram Login API) requires:

- A Meta business account
- An Instagram Business or Creator account linked to a Facebook Page
- Meta Developer app + App Review for `instagram_business_basic` permission (multi-day turnaround)
- Privacy policy URL, data deletion endpoint, app icon, marketing copy

That's days of process to get to the consent screen, for a feature 20 pilot users are unlikely to need on day one. The clustering logic itself is meaningful work, but it has no value without real Instagram data flowing in.

## Decision

For the pilot:

- The Phase 1 Instagram onboarding screen stays in place — it explains the future feature and offers a "Connect / Skip" choice. Both buttons advance the flow; neither talks to Meta. The "Connect" branch lands on a stub explainer.
- We do **not** build the OAuth flow, the `import-instagram` edge function, or the clustering logic in Phase 4.
- Photo upload via `expo-image-picker` (built in Phase 2.7) is the supported path to populate trips. It works on iOS, Android, and web.
- A future Phase 4.5 will revisit Instagram once we have a Meta business account and an Instagram Business account; the clustering logic will live in a new edge function and reuse the trip schema from Phase 2.

## Consequences

- Pilot users add photos manually — same friction Instagram-light apps like Polarsteps had at launch. Acceptable for 20 users.
- The build plan's §4.4 (recommend stays / map view) and §4.5 (anything that depends on imported trips) are not affected — they were already deferred to post-v0.
- No legal/privacy/Meta compliance work needed pre-TestFlight.
- When we do build it, the consent screen + clustering live in their own ADR and migration; this ADR is the trail.
