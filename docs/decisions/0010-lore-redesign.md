# ADR 0010 — lore. redesign (Batches A/B/C)

## Status

Accepted — shipped across slices 4–6 of the lore. redesign.

## Context

The original Postmark→lore brief shipped a 10-screen onboarding-heavy
flow against a warm-cream palette + Fraunces/Inter type. On-device walks
showed three problems:

1. The friend's voice wasn't surfaced first on recommendation cards. The
   place name led, which made every screen feel like Yelp.
2. The five-point trust signal (heart counts, ratings) crept back in as
   the data model grew, conflicting with the "friend's quote is the
   trust signal" thesis.
3. The cream-paper aesthetic read as a journaling app, not a network.
   Reviewers consistently asked "is this for me alone, or for friends?"

A fresh brief landed with a 16-screen redesign + new design tokens. This
ADR captures the architectural choices that resulted.

## Decision

### 1. Thesis — friend's voice is the unit

Every recommendation surface leads with **face + name + relationship
cue (when, how often)** before the place name. Rule 1 of the design
system, enforced in `FeedScreen`, `DestinationScreen`,
`PlaceRedesignedScreen`, `TripNotebookScreen`. If a card leads with the
place name, that card is wrong.

### 2. Sentiment — three buckets, logger-only

`tips.verdict` (`love` / `mid` / `skip`). No stars, no 5-point scales.
Captured in `VerdictPicker` on the Log screen. Surfaces on the logger's
own Profile + Wrapped only — friends never see the rating, they see the
quote. Migration `0008_verdict_and_tip_uses.sql`.

### 3. Type stack — Instrument Serif / Geist / JetBrains Mono

Replaced Fraunces/Inter. Italic serif is the human voice (titles,
quotes, the wordmark). Geist is the UI sans. JetBrains Mono is reserved
for eyebrows (uppercase, letter-spacing 1.4, paired with a 6×6 colored
dot via the `Eyebrow` primitive).

### 4. Palette — one accent, four category markers, one gradient

Coral `#FF4D2E` is the only primary accent. Pink, emerald, gold sit
next to category pills only — never as button backgrounds. The single
allowed gradient (coral → gold) lives on the Wrapped screen.

### 5. Validation surface — the `tip_uses` table

New table backing the Validation modal (#14) + Wrapped's
"38 used by friends" stat (#15). Idempotent unique (tip_id, user_id);
RLS allows both the using friend and the original tip author to read
their slice. Push trigger lives in a forthcoming edge function;
modal surface ships in this slice with a fixture.

### 6. Anonymous auth stays

ADR 0004 unchanged. The "Send me a code" hint on the Login screen is
visual — `useStartSession({ phone })` signs in anonymously and stores
the hashed phone. No SMS round-trip.

### 7. Instagram OAuth still deferred

ADR 0005 unchanged. The Import (#5) screen renders a mocked Instagram
fixture + the real camera-roll classifier (from ADRs 0008/0009) in two
sections on the same screen, sharing one selection model.

## Consequences

- Adds two runtime deps: `expo-linear-gradient` (Wrapped/Profile
  gradient panel only), three `@expo-google-fonts/*` packages (Instrument
  Serif, Geist, JetBrains Mono).
- Migration `0008` adds `tips.verdict` + `tip_uses` table; both
  optional; existing rows unaffected.
- `home_city` (ADR 0009) stays — the camera-roll classifier still uses
  it. Brief omits Framing from the 16-screen flow; we kept it as an
  uncounted sub-step between Login and Circle. Brief is silent on where
  display_name is captured.
- Legacy screens (`cover-screen`, `problem-screen`, `promise-screen`,
  `place-detail-screen`, `book-screen`, `TripSpine`, `OpenBookMark`,
  `EyebrowLabel`) deleted in this slice. `trip-detail-screen.tsx` kept
  for the edit + entity-confirm flow until those move into the
  Notebook surface.
- Cream `#FAF8F3` and terracotta `#993C1D` swept out of the codebase
  in this slice's commit. Theme aliases (`brand`, `accent`, `paper`,
  etc.) re-point at the new tokens so any straggler import keeps
  compiling; the aliases will be removed once we're sure nothing in
  Phase 4–5 code references them.

## What this ADR does NOT cover

- Floating-pill `Nav` primitive wiring. The primitive exists and is
  used on `/dev/components`; wiring it to replace the Expo Router
  default tab bar is a separate polish commit.
- Real follow mutations on Taste-makers — those need backend
  verified-traveler IDs, post-pilot.
- The Validation push trigger (edge function) — surface only ships in
  this slice; the trigger is a separate task.
