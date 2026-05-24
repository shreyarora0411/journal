# ADR 0009 — Location-first trip clustering

## Status

Accepted — slice 3 of the lore. redesign.

## Context

Slice 2 added GPS-based destination seeding to the camera-roll import
(ADR 0008), but clustering still trusted a single rule: any 3+ photos
inside a 36h window became a "trip". On a real Indian metro user's
camera roll, that produced loud false positives — weddings at farmhouse
venues, weekend brunches, friend's birthday party, screenshots from
WhatsApp groups. The user reported "the photos coming are making no
sense in clustering".

A pure-time rule cannot tell a weekend at home from a real trip.
Distinguishing the two is fundamentally a geographic question.

## Decision

The user manually sets a **home city** in the existing Framing
onboarding step (step 2 of 4). We forward-geocode that string into
lat/lng + ISO country code, and store all three on `public.users`
alongside the typed string. Onboarding never asks for the user's
*current* location, only their home.

After clustering by 36h gap (unchanged), each cluster is run through a
classifier (`classifyCluster` in `cluster.ts`) with the following
rules, in order:

1. **No GPS at all** → `unknown` (rendered in a separate section the
   user opts into).
2. **Different country from home** → `trip` (a Singapore stopover is a
   trip regardless of distance/duration).
3. **No home configured** (returning user pre-slice-3) → `trip` (fall
   back to slice 2 behaviour, all clusters are trip-candidates).
4. **Centroid > 200km from home** → `trip`.
5. **Centroid 50–200km from home** AND (multi-day OR ≥ 8 photos) →
   `trip`.
6. **Else** → `drop` (day-out at home, wedding venue, friend's house).

The classifier runs after screenshot filtering and GPS sampling. GPS is
sampled across the cluster's duration (`sampleSpread`) so the centroid
reflects the whole trip, not just day 1 at the airport.

A second pass (`splitClusterByLocationJumps`) cuts trip-clusters where
adjacent days' median locations sit > 200km apart — two back-to-back
trips that the time-gap rule glued together.

## Consequences

- Onboarding gets a third field on the Framing screen ("Where do you
  live?"). Adds ~3 seconds; replaces a much larger downstream cost
  (untoggling 20 false-positive clusters in the import screen).
- ~80% of false-positive clusters are dropped. The "Not sure these are
  trips" section is the user's escape hatch for the rest.
- Adds `home_city`, `home_lat`, `home_lng`, `home_country_code` columns
  to `public.users` (nullable). Migration 0007.
- No new dependencies — uses `expo-location.geocodeAsync` /
  `reverseGeocodeAsync` shipped in slice 2.
- Returning users without `home_city` set see an inline banner on the
  import screen; their import falls back to slice-2 behaviour until
  they set it.

## Privacy posture

Home city is treated as profile data (same as `display_name`). Lat/lng
is stored alongside it but never displayed; it's only used client-side
for classification. We do not expose it through any read path other than
the user's own profile (RLS covers this — the existing user-row policy
covers the new columns without changes).
