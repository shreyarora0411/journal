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

**Anti-gaming rule at the point of action (founder call, 2026-07-03):** the sentiment buttons carry NO algorithm hints ("trains your taste" etc. removed) — naming which tap feeds the formula invites performative logging. How signals work lives only on the how-it-works surface (see formula-transparency principle: ingredients, never coefficients, never at the moment of input).

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

### 3b. You tab — full redesign (SPEC APPROVED FOR PLANNING 2026-07-04, NOT YET BUILT)

The You tab is still the trust-era travel profile and contradicts the taste product everywhere else. Founder call: full redesign, planned now, built after sign-off.

**Role split:** Your Map (book tab) = the working artifact for YOU (log, gate progress, your notes). You tab = your PUBLIC taste identity + account home — "this is the map people borrow," plus controls.

**Sections, top to bottom:**
1. **Header** — Face (lg), display name, @handle; edit avatar/name/bio inline (existing profile-edit hooks).
2. **Taste identity card** — the derived readout (never self-declared), loves count, hubs covered ("14 loves · 5 hubs"). Tapping opens your own `person/[id]` page — you see exactly what a borrower sees. This is the anti-dating affordance turned inward.
3. **Your voice** — voiced-note count + latest note preview (Fraunces italic); a nudge listing loved places still missing a note ("6 places are waiting for your words") deep-linking into the log flow. Notes are the moat; this surface farms them.
4. **Lists** — the existing lists feature as curated shelves ("Date-night bets", "Solo coffee"); create/manage entry.
5. **Reach** — accepted follower/following counts framed as borrowing ("4 people borrow this map"); the WhatsApp invite entry (shared with People screen).
6. **Account** — default visibility, house rules, sign out.

**Rules:** identity always derived; no "match" as a noun; no gamified stats/leaderboards; no photo wall. **Data:** entirely existing hooks — `me()`, `useMyTaste`, `useMyPlaces`, `useFollowCounts` (accepted only), lists queries. No new backend.
**Build sketch:** new `features/taste/screens/you-screen.tsx` wired into `app/(tabs)/you.tsx`; retire profile-screen's travel-style blocks; keep avatar/name editing components.

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
6. ~~Pre-invite hardening~~ DONE (2026-07-04): **mig 61** re-tightened live users grants (phone_e164/home coords were readable + is_creator writable by any signed-in user — squashed-baseline drift; probes verified) and revoked TRUNCATE/TRIGGER/REFERENCES everywhere + all anon function EXECUTE. **Audit fixes shipped:** occasion tags castable at log time (WHEN'S IT FOR row; tag votes were ALSO always failing — ON CONFLICT needs SELECT on user_id which the de-attribution grant withholds; now delete-then-insert) + occasion-aware Go Out empty state; zone inference from NCR bounding boxes (`inferZone` in shared, safety net in the mutation — hub-less logs no longer vanish from Go Out; legacy travel rows honestly stay null); Delhi hubs pickable at log time; honest error states (LoadError + retry) on Map/Go out/Spot/Person/People; `backBehavior="fullHistory"` (back retraces spot→person→spot); note-save honesty (rating-saved-but-note-failed keeps the form + says so); PlacePicker searches the seeded corpus as fallback + no-results/offline row; taste-setup re-entry (prefilled quiz, finish-with-existing-loves, persistent door while priors missing); onboarding lands in taste-setup; Welcome + invite copy pivoted to taste; follow/unfollow now visibly updates taste surfaces (status='accepted' semantics, error toasts); hubLabel everywhere; +not-found redirect; polish batch. You-tab redesign SPEC'd (§3b), not built.
7. ~~Workstreams A/B/E + F/H polish~~ DONE (2026-07-04, via a 6-agent parallel workflow against docs/pending-work-plan.md, then gated/verified/committed): **You tab BUILT** (§3b) — derived identity card linking to the viewer's own person map, voiced-note count + nudge for loved places missing words, lists, reach (accepted-only borrower/following counts + WhatsApp invite), account controls; wired `bio` end-to-end (DB already granted it via mig 61, client silently dropped it). **TestFlight prep DONE** — eas.json profiles + docs/testflight-setup.md; biggest gap found: no app icon committed anywhere (only exists in the gitignored local ios/ folder, won't reach a cloud build). **Security advisor cleanup APPLIED** (mig 62) — dead `canonical_cities` definer view fixed (was the one ERROR), search_path pinned on 2 functions, avatars bucket listing closed, mv_friends_of_friends grants tightened (anon revoked entirely, authenticated cut to SELECT-only — kept, because useDiscover/useMatchedFriends genuinely read it, disproving the initial hypothesis it was dead). Two verified-but-out-of-scope gaps spun off as follow-ups: mig 61's anon EXECUTE revoke was a no-op on several functions (Postgres PUBLIC-grant quirk), and mv_friends_of_friends can't carry RLS so viewer_id is client-trusted, not enforced. **Small fixes**: hubLabel in PlacePicker, `taste.maps_opened` analytics event on both Open-in-Maps calls. **Live bug caught during verification** (not from the agents — from actually looking at the screen): `tasteReadout()` only names axes with a clear lean (±0.25); a few loves can pull a strong quiz-only signal back toward neutral and legitimately return nothing, so Your Map / You tab were telling users who already had loves to "log a few places" — fixed on both screens to distinguish "never logged" from "logged, taste still forming." **Workstream C (dummy-data wipe) is a DRY-RUN REPORT ONLY, nothing deleted**: 140 non-founder rows across 9 tables (140 strict / 146 with cascade), founder's 38 legacy trust-era rows (all Thailand/Bangkok, zero Gurgaon) flagged separately as the founder's own call, `canonical_places`/`category_priors`/`taste_tags` confirmed untouched — needs an explicit founder go/no-go before anything is deleted. **Workstream D (seed pass 2) is DRAFT ONLY, nothing applied to Trail**: 26 new venues across the 6 previously-empty hubs + 14 rows fixed, but a manual re-read (beyond the automated guard) found 16 rows resolved to a plausible-but-wrong business (mall/complex itself, or an unrelated similarly-named venue) — several are pre-existing rows already live on Trail from seed pass 1. Founder must review before any apply.
8. ~~Go-live execution~~ DONE (2026-07-05): **migs 63/64** closed the PUBLIC-pseudo-role EXECUTE leak (mig 61's per-role revoke was a no-op against the default PUBLIC grant — proacl `=X` entry; get_phone_for_friend also gained `status='accepted'` gating, proven with a rolled-back blocked-pair probe) and moved friends-of-friends reads behind an auth.uid()-bound RPC (`my_friends_of_friends()` — matviews can't carry RLS, so the client-supplied viewer_id was spoofable; raw matview SELECT revoked). **Wipe executed**: all 44 non-founder auth.users cascade-deleted (in-txn asserts guarded founder data + shared vocab; follows_refresh_mv trigger disabled/re-enabled around it because REFRESH CONCURRENTLY can't run in a txn). **Legacy→taste conversion**: founder's 16 place-linked Thailand vouches backfilled as loved reactions (every row traces to a vouch he wrote; skips/tips excluded) — founder at **19 loves**, past the gate; verified live on Your Map with notes. **Seed pass 2 applied**: 71 Gurgaon venues across all 15 hubs, zero known wrong-identity rows after per-row manual verification (6 fuzzy-resolved rows excluded, 2 pre-existing wrong live rows purged; 13 dropped venues need founder ground truth to re-add — list in the seed commit). **12 legacy routes stubbed** to redirect to Book. **App icon**: the gitignored ios/ icon was a blank white square (pixel-verified) — generated a wordmark-true placeholder (serif V + coral period on paper) and wired app.json, version 1.0.0. Hygiene: .env.example synced, operations.md fixed, docs/accepted-risks.md created. All sim-verified on a clean bundle; advisor still 0 ERRORs. ~~Known UX gap: list detail's "+ Write a vouch" drops list context~~ FIXED (2026-07-05): Log screen reads the listId/listTitle route params, shows a persistent "Adding to <List>" banner, and the new vouch is attached to the list via the same vouch_list_items write "+ Add existing" uses. Handles the edge case honestly — a list holds vouches, and the note is optional everywhere else in Log, so saving with no note correctly reports nothing attached rather than pretending it did. Verified live against Trail both ways (note→attached, no note→honest non-attach).
9. Recruit ~20 first (then the 250); run the seed cohort; measure against §3's success bar. Founder-only before invites: Google key restriction + EAS/TestFlight (docs/testflight-setup.md), on-device QA of the five hero flows.
