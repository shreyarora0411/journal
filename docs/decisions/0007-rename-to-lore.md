# 0007 — Rename Postmark → lore

**Status:** Accepted
**Date:** 2026-05-12

## Context

The product brief was refreshed and the working name was changed from
`Postmark` to `lore.` (the trailing period in brand color is part of the
wordmark). The first design pack iteration shipped under Postmark; the
second is built around the new wordmark.

The internal repo, GitHub org slug, and EAS project id all reference
`postmark` / `journal`. Changing every identifier risks losing build
history and analytics continuity for a pilot that's already deployed.

## Decision

- **User-facing name → `lore`.** App display name in `app.json`, all UI
  copy, README headlines, ops doc top lines, marketing screens.
- **`slug` and `scheme` → `lore`.** These flow into Expo's deep-link
  surface; flipping them now means future invite links / Universal Links
  use the new brand.
- **Bundle identifier stays `com.shreyarora.postmark`** on both iOS and
  Android. Changing it resets the EAS project, invalidates installed
  TestFlight / Play Internal builds, and forces re-signing. Not worth
  the breakage for a wordmark rename.
- **Repo folder + GitHub repo name stay `journal`.** Renaming a Git
  repo invalidates clone URLs and webhooks; the folder is internal.
- **Code identifiers (`@journal/mobile`, `@journal/shared`)** stay too —
  no user surface, refactor cost is real.

## Consequences

- The product looks like `lore.` to the user; internal tooling still
  says `journal` / `postmark`. Documented here so the next developer
  doesn't try to "fix" the mismatch.
- If we ever change the bundle id (e.g. for a hard relaunch), this ADR
  is the marker for what else moves with it.
- ADR 0005 (Instagram deferred for pilot) and ADR 0004 (anonymous auth)
  stay in force.
