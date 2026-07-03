# Taste-Graph Pivot — Thesis, Taste Logic, MVP Spec

**Status: DECIDED direction (2026-07-03), pre-build. This supersedes the trust-graph/travel framing in CLAUDE.md §0 for product direction; the codebase base is KEPT and reused.**
Owner: Shrey. This doc is the single source of truth for the pivot — a fresh Claude/Opus session should read this first, then the memory files.

---

## 0. How we got here (compressed)

- Original product ("Vouched"): friends-only, trust-graph TRAVEL recs. Voiced vouches, no stars, relevance = who you trust. Explicitly NO taste-similarity engine.
- Problem 1: travel is 2–10×/year → can never bootstrap frequency/supply. Going-out is weekly.
- Problem 2 (founder's real painpoints): (1) "I want to log/recommend places I've been"; (2) "I want recs from people with SIMILAR TASTE when I visit somewhere or go out."
- An adversarial 5-skeptic panel rejected the naive version of #2 (collaborative filtering / taste-twin strangers matched on shared venues): CF on co-visited places is mathematically dead on a sparse graph. The app has NOT launched (all prior DB data is dummy/seed — ignore any "0 interactions" analysis, it was on dummy data).
- Resolution: taste as a **portable PROFILE** (match people on a small attribute vector, not on shared venues). This works from a handful of logs, across cities, with no ML.

## 1. Core thesis

**Follow taste, not places or crowds.**

Your taste, made legible and followable — a living, voiced map of the places you love, that answers "where should I go?" the way your best-taste friend would.

- **Single-player first**: logging must be genuinely better than a Notes list / Google saves at n=1. People log for THEMSELVES (memory + identity), not as altruism. That's what fills the graph from zero.
- **Taste-matched second**: recs come from people whose taste provably matches yours — friends first, but a high-match stranger can outrank a low-match friend.
- **Local is the habit; travel is the payoff.** Locals logging their own city (weekly) ARE the travel corpus for visitors (byproduct). One app, one taste graph, one portable profile. Travel switches on city-by-city once density exists — never a separate product, never the launch wedge.
- Moat: NOT the algorithm (copyable). It's (a) logging that's genuinely better than Notes, (b) one dense high-taste community, (c) the voiced note + who-loved-it provenance (unscrapeable).
- Keep from the old thesis: voiced immutable notes, no public stars/ratings ever, person-led provenance ("who + their words" always visible).

## 2. The logic of taste (the engine)

**The move: tag PLACES lightly; a person's taste = the running average of places they loved.** Nobody self-describes taste. No user-user co-visit CF.

### ① Place fingerprint
- **5 bipolar axes**, floats −1..+1:
  1. substance ↔ scene (is the point the food/drink, or the atmosphere/being-out) — the master split
  2. mellow ↔ lively (quiet/intimate vs loud/high-energy)
  3. adventurous ↔ trusty (novelty-chasing vs go-where-it's-proven)
  4. refined ↔ unfussy (polished/elevated vs casual/rough-edged)
  5. value ↔ splurge (willingness to pay for the right thing, not budget)
- **Tags** (sets): format/cuisine (natural-wine, small-plates, izakaya, specialty-coffee, cocktails, regional-Indian, live-music, …) + occasion (solo/coffee, date, small-group, big-night, late-night).
- Source: `fingerprint = blend(category_prior, crowd_tags)`. Category prior (e.g. cocktail bar starts lively/scene-ish) so no place is ever blank; crowd tags (2–3 optional taps at log time) take over as logs accrue (~5–10 logs to converge). Founder hand-seeds top ~200 venues of the beachhead neighborhood.

### ② User taste vector (computed, never declared)
```
axes(user) = Σ loved · recencyWeight · place.axes  −  ½ Σ skipped · recencyWeight · place.axes  → normalize
tags(user) = frequency profile of tags on loved places
```
Logging IS profile-training. Sentiment (loved/fine/skip) is **PRIVATE** — powers your recs + match only, never shown publicly (kills star-posturing; public artifact = the voiced note).

### ③ Taste-match (person↔person) — ASYMMETRIC, skip-aware (mig 58)
```
match(viewer→other) = 0.7 · cosine(axes_full(viewer), axes_lovesOnly(other))
                    + 0.3 · weightedJaccard(tags(viewer), tags(other))   // 0..1
```
Viewer side = FULL vector (loves + their OWN skips at −0.5 + onboarding priors)
— zero leak, it's their own data, result shown only to them. Other side =
LOVES-ONLY, because the scalar is externally observable and the target's
private skips must never be reconstructable by vector-steering (adversarial
review). So match(A→B) ≠ match(B→A) — correct, "fit to YOU" is viewer-centric.
Plain SQL over 5 floats + tag sets. No ML/embeddings/pgvector. Matches across
cities (portable profile) — two people can match having never logged the same
venue. Deferred tune (v1.2, sketched): per-place disagreement penalty in
recommend_places — downweight a lover whose loved places the viewer has
personally skipped (viewer-side data only, zero leak), e.g. weight ×0.7^min(disagreements,3).

### ④ Recommendation (query = {area, occasion, category})
```
candidates = places in area matching occasion/category with ≥1 love
score(p) = MAX over lovers X [ match(you,X) · recency · followBoost(X) ]
         + λ·log(1 + Σ other lovers' match)
followBoost = 1.3 if you follow X else 1.0
```
MAX term = taste-led (best-matched lover), NOT popularity; log term = mild support w/ diminishing returns. Surface always shows WHO (top-match lovers by name) + their voiced note + Open in Maps: "Loved by Priya + 2 others who go out like you."

### Cold-start (honest, never faked)
- New user: onboarding "pick 5 places that are SO you" (inherit fingerprints) + 3–4 either/or taps → real vector day one.
- New place: category prior → rankable pre-tags.
- Thin area: degrade LABELED — friends' loves → tribe's most-loved → "be the first." Never invent a match.
- **Confidence gate**: show "goes out like you"/match only when both sides have ≥~8 loves; below, lean on follows + tribe-loved, unlabeled.

## 3. Product MVP

**The 10-second loop:** Log place → one-tap loved/fine/skip → optional one-line voiced note → optional ≤3 tags → lands on Your Map + trains taste. Going out: pick area + occasion → taste-matched spots with who + why. Follow people whose maps you love.

**Five screens only:**
1. **Your Map** (home + identity): loved places + taste read-out ("substance-first, adventurous, splurges on food") + lists. **Make-or-break screen — must beat Notes/Google-saves as a personal artifact.**
2. **Log**: place picker → sentiment → voice line → tags. Fast door; nothing required beyond place+sentiment.
3. **Go out**: "Tonight in {area}" → area + occasion → ranked taste-matched spots (lover names + voiced note + Maps).
4. **People**: taste-twins + tastemakers, surfaced by match; person page = their map + "you agree on 8/10."
5. **Place page**: who in your taste-orbit loved it, their words, Maps.

**Onboarding** (strong match inside 5 logs): pick 5 signature places → 3–4 either/or taps → follow 3 taste-matched seed-tribe people.

**IN scope:** the loop; private sentiment; 5-axis engine; area+occasion discovery; follow; ONE neighborhood, ONE city, food/drink tribe; top ~200 venues hand-fingerprinted.
**OUT (v1):** travel mode (emerges later); at-scale stranger CF; public stars (never); required tagging / rich taxonomy; push (banned); cross-city; monetization.

**Launch = NOT app store.** Hand-recruited invite-only seed, ~200–250 food/drink-obsessed 25–35s in one neighborhood (TestFlight), founder-run.
**Success bar:** ~2+ logs/person/week for 3+ weeks; discovery beats "Google/ask the chat" for the cohort; taste-twin (non-close-friend) recs get acted on.
**Kill signals:** logging doesn't recur unprompted (no push exists to save it); Your Map doesn't beat Notes; matches feel random.

## 4. Rollout phases

- **Phase 0 (seed):** food/drink obsessives, one neighborhood. Highest taste-overlap + they ARE the tastemakers. Saturate the pocket; calibrate the engine substance-first.
- **Phase 1 (widen by occasion, same people):** drinks → nightlife → late-night via occasion tags. No new cold-start.
- **Phase 2 (harvest demand):** new-in-city/relocators — acute pain, pure demand, near-zero supply; open only once the map is dense.
- **Travel:** switches on as a MODE per city once 2+ metros are dense. Same profile ("your Bombay taste predicts your Lisbon picks").
- **NEVER:** simultaneous multi-tribe launch (scatters taste-overlap density — the #1 death mode).

### 4b. Beachhead — DECIDED (2026-07-03): Delhi NCR, Phase 0 = ENTIRE GURGAON

- **Market: Delhi NCR. Phase 0 = ALL OF GURGAON** (founder's call, 2026-07-03), not Gurgaon+Delhi at once. Founder is Gurgaon-based (access = the deciding criterion). Delhi is Phase 0.5, pulled in by the same users, not launched separately.
- **Why entire Gurgaon is the right bounded unit:** Gurgaon behaves as ONE going-out market — everything is a 15–25 min drive and the F&B scene concentrates into hubs anyway. The v1 chip list (GURGAON_HUBS in packages/shared/src/taste.ts, 15 hubs): **32nd Avenue · CyberHub · Golf Course Rd · GC Extension · M3M IFC · Worldmark 65 · Sector 29 · Galleria · Cross Point · South Point · MG Road · The Kitchens · Sohna Road · Sec 68/Airia · Udyog Vihar**. "Entire Gurgaon" ≈ those hubs, so seed density survives. (The Kitchens = the curated 10-restaurant complex at Global Gateway Towers, MG Road/Sector 26 — Anjeer, Easy Tiger by Boraan, Vellam, Asper, Niko, The Fio Table, Miss Margarita, Mjöl, EVOO, Fig; Zomato/EazyDiner treat it as its own locality, so it earns its own chip distinct from the MG Road mall strip.)
- **Seed guardrail:** hand-fingerprint the **top ~300 venues ACROSS the hubs, prioritized by where the tribe actually goes** — never exhaustive coverage. The Gurgaon hub list above = the v1 area chips.
- **Phase 0.5: South Delhi cluster** — Mehrauli/Dhan Mill, Khan Market/Lodhi, GK-2. The "substance" capital; the Gurgaon tribe already drives there for the good nights, so it seeds via the same users (they are the bridge).
- **NCR-specific product requirements:**
  1. **"Area" = named hub CHIPS, not GPS radius** (the 12-hub list in §4b above; later + Khan Mkt · Mehrauli · GK) — that's how NCR decides ("CyberHub or 32nd?").
  2. **Drive-worthiness is part of the rec**: show the hub/zone on every card; the voiced note answers "worth the drive?" (Gurgaon↔Delhi is a 45–75 min bet).
  3. **Gurgaon + Delhi = ONE graph, two zones** — never two cities in the data model; seed users span both weekly.

## 5. What reuses from the existing codebase (kept as base)

- `vouches` table (voiced note + category + place link) → the log unit. Add nullable `sentiment` ('loved'|'fine'|'skip') + place-fingerprint tables via new append-only migrations.
- `canonical_places` + Google place resolution → place identity. `lists`, `follows`, profile-as-identity, composer fast-door, search RPC structure, Feather icon system, Vouch wordmark — all reuse.
- `search_vouches` ranking structure reuses; relevance term shifts from trust-tier to taste-match.
- Drop/demote: trust_contexts as PRIMARY signal (becomes a boost), travel destination framing, "upcoming trip" surfaces.
- Live Supabase = Trail project (zcqnffylqfzoeibtkuty); NOTE the DB has drifted from repo migrations — verify object existence, don't trust the tracker. All current data is DUMMY (pre-launch); safe to reset when building.

## 6. Open decisions (founder input needed)

1. ~~Which city + neighborhood~~ **DECIDED: Delhi NCR, Gurgaon-first (see §4b).** Remaining sub-question: confirm/redraw the exact corridor + confirm Shrey can personally reach ~200–250 of the Gurgaon food/drink tribe.
2. Name/brand: "Vouch" wordmark shipped; revisit vs taste-first framing?
3. Exact tag vocabulary v1 (keep ≤ ~24 format tags + 5 occasions; tune to NCR: regional-Indian, cocktail-bar, brewery [Gurgaon-specific], café/specialty-coffee, late-night…).
4. Onboarding "5 signature places" UX: search-pick vs curated grid of the ~200 seeded corridor venues (grid is likely better — zero typing, instant fingerprint).

## 7. Next actions

1. ~~Founder: pick city~~ DONE (entire Gurgaon, §4b).
2. ~~Taste-engine migrations + scoring RPC~~ BUILT + APPLIED to Trail (2026-07-03): migrations 55 (engine — adversarially reviewed, 3 blockers + privacy hardening fixed: de-attributed tag votes, loves-only cross-user match, blocked-pair suppression, visibility-gated notes, argmax tier), 56 (vocab seed), 57 (find_or_create_place / taste_twins / place_lovers), 58 (asymmetric match: viewer full vector vs other loves-only), 59 (user_loved_places — person map), 60 (citext fix: users.handle is citext on Trail; taste_twins/place_lovers RETURNS TABLE `handle text` threw 42804 at runtime — cast ::text at select site; recommend_places unaffected via jsonb). Shared math+vocab in packages/shared/src/taste.ts (parity contract, 26 unit tests).
3. ~~The screens~~ BUILT + verified live in sim (2026-07-03): features/taste/* — Your Map (book tab; readout + gate progress + places), Log (add tab; place→sentiment→note→≤3 tags→hub), Go out (search tab; zone/hub/occasion chips, honest tiers), People (friends tab; taste-twins, honest 8-love gate, rows open person map), Spot (spot/[id]; lover cards open person map), **Person (person/[id]; person AS a map — % taste overlap or honest gate line, Follow map, their loved places → spot; the structural anti-dating affordance)** + Taste setup onboarding ((tabs)/taste-setup: 4 either/or → priors; pick-5-loves → real reactions). Old trust-era screens remain unrouted in repo. Tab bar: Map/Go out/Log/People/You.
4. ~~Seed tooling~~ BUILT + first batch APPLIED: docs/seed/gurgaon-venues.csv (draft, founder-correctable) + scripts/seed-gurgaon-places.ts (Places-API-verified, duplicate-resolution guard) → supabase/seed/gurgaon-places.generated.sql. 31 clean venues live on Trail (13 flagged/excluded rows need founder fixes); Anardana + Molecule re-hubbed to m3m_ifc, Blue Tokai AIPL to gc_ext. Founder: correct flags + extend toward ~300.
5. ~~DEPLOY~~ DONE (2026-07-03) per docs/deploy-taste-pivot.md: migrations 55–60 applied, 31 venues seeded, RLS smoke passed (tag-vote attribution denied, direct axes call denied, 0 foreign reactions), client E2E in sim (quiz → priors → love → readout → person map → spot). Old dummy data NOT wiped — decide before invite-out.
6. Recruit the 250; run the seed cohort; measure against §3's success bar.
