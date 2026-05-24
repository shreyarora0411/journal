# ADR 0008 — Seed camera-roll trip destinations from photo GPS

## Status

Accepted — slice 2 of the lore. redesign.

## Context

The camera-roll import (ADR 0005) clusters the user's last six months of
photos into proposed trip drafts. The original UI then asked the user to
type a destination ("Where to?") into each cluster. In on-device walks,
this was the single biggest friction in onboarding: 20–30 clusters, no
one remembers exact dates, and the empty inputs read as homework.

Modern iPhones and Pixels write EXIF GPS into the photo asset by
default, and Apple/Google both expose that location through
`expo-media-library`'s `getAssetInfoAsync`. Both platforms also ship a
native reverse geocoder accessible via `expo-location`'s
`reverseGeocodeAsync` — free, no API key, no per-request cost.

## Decision

After clustering, the loader samples up to 5 photos per cluster, reads
their GPS via `MediaLibrary.getAssetInfoAsync`, averages the lat/lng
into a centroid, and calls `Location.reverseGeocodeAsync` once per
cluster. The first usable label (`city ?? subregion ?? region`) becomes
the cluster's `suggestedPlace`. The import screen pre-fills the user's
`Where to?` input with that string. The user edits the misses; nothing
else changes.

When any link in the chain is missing — no GPS in any sampled photo,
geocoder returns nothing, permission denied — `suggestedPlace` is left
undefined and the input renders empty. The feature is additive, never
blocking.

We also render the first three cluster photos as a thumbnail strip
above each input, so users recognize a trip by image even when GPS is
absent.

## Consequences

- 60–80% of clusters arrive pre-named in the target audience (iPhone /
  modern Pixel default-on GPS, India travel use case).
- One additional permission prompt is acceptable: photo library
  permission already gates the whole flow. `expo-location` isn't
  separately invoked because we never request the *user's* current
  location — only reverse-geocoding of points we already have.
- Privacy: GPS reads stay on-device. We do not upload raw lat/lng. The
  only thing that hits the server is the city string the user confirms
  in the `Where to?` field. This sits cleanly with CLAUDE.md §9 (EXIF
  stripped on upload, GPS extracted server-side and stripped).
- Adds `expo-location` (~19.x) as a runtime dependency.

## Fallback chain

1. Photo has `location` → centroid → geocode → `city` → use.
2. `city` missing → `subregion` → use.
3. `subregion` missing → `region` → use.
4. Geocoder returns empty / throws → `suggestedPlace = undefined`, input
   stays empty, user types as before.
5. Any sample call to `getAssetInfoAsync` rejects → swallow and continue
   to the next cluster.
