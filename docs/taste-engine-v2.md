# Taste Engine v2 — Roadmap (Spotify architecture, mapped honestly onto Vouch)

**Status: engineering roadmap, staged by user scale. Nothing here changes what ships today.**
This is the document migration 68 (`place_interactions`) points at. It maps Spotify's
recommendation architecture onto the taste engine (`packages/shared/src/taste.ts` +
migrations 55/56/57/58/65/67/68) and says explicitly which layers are real at which
scale. The governing constraint is scale-honesty: at ≤10 users, most of Spotify's
architecture is noise-generating theater, and the engine must never pretend otherwise
(same doctrine as the honest tiering in `recommend_places()` — label the fallback,
never invent a match).

Constitution constraints that bind every stage (CLAUDE.md §0, docs/taste-pivot-spec.md):
**no LLM extraction, no push, no stars, lists are optional containers, sentiment is
private.** See Non-goals at the end.

---

## 1. The Spotify architecture, and what Vouch already has

Reference model (music-tomorrow.com's architecture guide), five layers:

1. **Content-based features** — metadata, raw audio analysis producing dense feature
   vectors, semantic embeddings from text.
2. **Collaborative filtering keyed on playlist co-occurrence** — ~700M playlists; "two
   songs are similar if users put them on the same playlist," a stronger signal than
   shared-listener overlap.
3. **Context-aware user profiles** — per-cluster interest embeddings; recent activity
   outweighs history; explicit feedback (saves, playlist-adds) outweighs passive plays;
   the same action means different things in different session contexts.
4. **Multi-stage ranking** — candidate generation, then feature-specific re-ranking with
   a separate reward function per surface (Discover Weekly ≠ autoplay ≠ search).
5. **Cold start** — content features carry ranking until behavioral data accumulates.

What Vouch already implements, layer by layer:

| Spotify layer | Vouch analog | Where |
|---|---|---|
| Raw audio analysis → dense feature vector | **Per-place 5-axis fingerprint** (`canonical_places.axes`, mig 65) — a hand-set dense vector per venue, preferred over the category prior by `place_axes()`. Populated by founder fingerprinting tooling: `scripts/export-axes-draft.ts` (draft from live corpus) → founder edit → `scripts/apply-axes.ts`. | `taste.ts` `blendFingerprint()`, mig 65 |
| Track metadata | **Category priors** (`CATEGORY_PRIORS`, `category_priors` table) + crowd **format tags** with `axisEffects` applied by vote share (`place_tag_votes`, `place_axes()`). | `taste.ts`, migs 55/56 |
| Semantic text embeddings | **Deliberately absent.** Voiced notes are read by humans, never mined (no-LLM constitution). The structured substitute is `place_dishes` (mig 67): "what to order" captured as chips at log time. |
| Saves weighted over passive plays | **Explicit `loved`/`fine`/`skip`** (`place_reactions`) is the only profile-training input; `fine` contributes zero, `skip` pulls at −0.5. There is no passive-signal contamination to fight — yet. | `userTasteAxes()`, mig 55 §8 |
| Recent activity outweighs history | **180-day half-life** on every reaction (`TASTE_TUNING.reactionHalfLifeDays`), in both the user vector and `placeScore()` recency. | `taste.ts`, SQL `power(2.0, -age/180.0)` |
| Session context | **Occasion tags** (`OCCASIONS`: solo_coffee/date/small_group/big_night/late_night) gate the Go Out query — they are query context, not taste traits, by design. | `recommend_places(p_occasion)` |
| Implicit signal capture | **`place_interactions`** (mig 68): `maps_opened`, `place_shared`, `taste_card_shared`, `wishlist_add`, `list_add`. Capture-only today; nothing reads it. | mig 68 |
| Cold start via content | Category prior → every place rankable pre-tags; onboarding either/or quiz (`user_taste_priors`, weight 2) + pick-5-loves → real user vector day one; **8-love confidence gate** (`confidenceMinLoves`) before any match is shown. | spec §2, mig 55 |
| Ranking | `placeScore()` = MAX over lovers (match × recency × followBoost 1.3) + λ=0.15 log-support; person↔person `tasteMatch()` = 0.7·cosine + 0.3·weighted-Jaccard, asymmetric loves-only on the other side (mig 58). | `taste.ts`, `recommend_places()` |

The one Spotify layer with **no** Vouch analog at any scale in this doc: user-side
embedding clusters. Five interpretable floats + a tag histogram is the whole profile,
on purpose — it survives the no-ML constraint and stays explainable on the You tab.

---

## 2. NOW (≤10 users): content features or nothing

**Why collaborative filtering is architecture theater at this scale.** CF's entire
value is that co-occurrence statistics beat content features once the interaction
matrix is dense. With ≤10 users and 71 seeded venues, the matrix has a handful of
nonzero cells; any "users who loved X also loved Y" computation is a rounding error
wearing a lab coat — it would just re-derive "the founder loved both." The adversarial
panel already killed co-visit CF for exactly this reason (spec §0); the resolution was
the portable attribute vector, and that resolution still holds. Do not build CF
plumbing now. Every cycle goes to the layers that work at n=3:

1. **Content features (the fingerprints).** Spotify leans on audio analysis when
   behavioral data is thin; our equivalent is `canonical_places.axes`. Migration 65
   documented the failure mode: 36/71 venues categorized bare `restaurant` (prior =
   all-zeros), ~1 tag vote in the DB → the corpus carried no signal and `taste_match`
   computed ~0 between any two real users. **Action: fingerprint all 71 live venues**
   via `scripts/export-axes-draft.ts` → founder pass → `scripts/apply-axes.ts`. This is
   the single highest-leverage engine task that exists.
2. **Dish data as a content feature.** `place_dishes` rows are structured
   what-to-order signal captured at log time (no-LLM-compliant). Near-term use is
   retrieval/display (already on `place_lovers()`); engine use (dish-overlap as a
   tag-like similarity term) waits for enough rows to mean anything.
3. **Occasion coverage.** `recommend_places(p_occasion)` filters on `place_tag_votes`
   — a venue with zero occasion votes is invisible to an occasion-filtered query.
   Founder should cast occasion tags across the corpus while logging, or the Go Out
   occasion chips return honest-but-empty states forever.
4. **The follow graph + honest gates keep carrying ranking.** `followBoost` 1.3, the
   `tribeWeight` 0.35 labeled fallback, and the argmax tier label (`taste`/`follows`/
   `tribe`) are the correct ranking story until matches clear the 8-love gate for
   multiple pairs.

---

## 3. AT ~50 USERS: the playlist analog switches on

This is the scale where co-occurrence stops being pure noise (dozens of users × weekly
logging = hundreds of reactions/quarter). Four additions, in order:

1. **List co-occurrence — the playlist analog.** Spotify's strongest similarity signal
   is playlist co-occurrence, not shared listeners. Our dataset is **`vouch_list_items`**:
   a user putting two places on "Date-night bets" asserts they belong together, which
   is exactly the playlist claim. Lists are optional containers (constitution), so this
   is sparse but *high-precision* — every co-occurrence is deliberate curation.
   Implementation: a nightly-refreshed pair count (place_a, place_b, distinct-curator
   count) feeding a "similar places" term. Threshold at ≥2 distinct curators before a
   pair counts; a single list is one person's opinion.
2. **Implicit-signal weighting into `placeScore()`.** Start reading `place_interactions`:
   `maps_opened` = intent (the user tried to go), `place_shared` = strong endorsement
   (spent social capital), `wishlist_add`/`list_add` = mild save-signal. Keep the
   Spotify hierarchy: explicit `loved` stays the dominant term; implicit signals enter
   as small additive boosts (suggest ≤0.1 each on the lover-weight scale), never as
   substitutes. Extend `TASTE_TUNING` with the new coefficients and mirror in SQL per
   the parity contract in `taste.ts`'s header.
3. **The disagreement penalty (v1.2, already spec'd).** Spec §2③: downweight a lover
   whose loved places the viewer personally skipped — `weight × 0.7^min(disagreements, 3)`
   inside `recommend_places()`. Viewer-side data only, zero privacy leak. This is the
   "same action, different meaning" idea in miniature: X's love means less *to you*
   once you've disagreed with X.
4. **Simple item-item similarity from co-loves.** "Users who loved both" as a
   place↔place score, blended with axis-cosine between fingerprints. Gate it honestly:
   require ≥3 co-lovers per pair before the term is nonzero, and let content similarity
   carry the rest — this is Spotify's cold-start posture applied per-edge.

---

## 4. AT ~500+ USERS: multi-stage ranking earns its keep

1. **Item-item CF proper.** Precomputed place-similarity matrix (co-love + list
   co-occurrence + fingerprint cosine), refreshed on a schedule, powering "more like
   this" on the Spot page and candidate expansion in Go Out. Still plain SQL —
   500 users × ~300 places stays trivially computable without embeddings.
2. **Per-surface reward separation.** Spotify runs separate reward functions per
   surface; ours split as:
   - **Go Out** optimizes *went-and-loved conversion*: impression → `maps_opened` →
     a later `loved` reaction on the same place.
   - **People** optimizes *durable follows*: taste-twin impression → follow → still
     `accepted` and generating map-visits 30 days later — not follow-count.
   - **The resurface row** (Your Map / Book) optimizes *return visits*: re-opens of
     the user's own logged places (memory value, the single-player promise).
   Concretely: one shared candidate generator, then per-surface re-rank weights —
   a `surface` parameter or thin per-surface RPCs wrapping shared scoring.
3. **Exploration bonus (bandit-lite).** A small additive bonus to candidates with few
   impressions for this viewer (ε-greedy is enough; no Thompson sampling ceremony), so
   the MAX-over-lovers term doesn't ossify into ten familiar places. Cap it so an
   unranked venue can never outrank a gated taste match — exploration is seasoning.
4. **Time-of-day context.** `place_interactions.created_at` and reaction timestamps by
   then carry enough history to condition occasion defaults (late_night chips
   pre-selected after 22:00) and to interpret ambiguous signals — a `maps_opened` at
   19:40 Saturday is going-out intent; at 15:00 Tuesday it's research. This is
   context-awareness, not a new model.

---

## 5. Measurement: how we know the engine works, per stage

The capture layer for all of this is `place_interactions` (mig 68) plus PostHog events
(`taste.maps_opened` already fires on both Open-in-Maps calls). Sentiment stays
private; all metrics are aggregates.

**Missing today and needed first: impression logging.** Nothing records what
`recommend_places()` *showed*. Without impressions there is no denominator — add a
lightweight impression capture (surface + place_id + rank) before trusting any
conversion number.

- **NOW:** (a) *Conversion proxy:* `maps_opened` within 24h of a Go Out impression —
  the only "did the user go?" signal available today. (b) *Fingerprint coverage:*
  % of live venues with non-null `canonical_places.axes` (target 100% of 71).
  (c) *Readout health:* % of active users whose `tasteReadout()` is non-empty —
  the mig-65 dilution bug's regression metric. (d) *Logging cadence:* ≥2 logs/person/
  week for 3+ weeks (the spec §3 success bar).
- **~50 users:** (e) *Closed-loop conversion:* impression → `maps_opened` → `loved`
  reaction on that place within 14 days, split by tier — **taste-tier must beat
  tribe-tier or the engine is decoration.** (f) *Match validity:* for pairs above the
  8-love gate, does higher `taste_match` predict the viewer loving the other's loved
  places? (g) *List-pair precision:* spot-check top co-occurrence pairs against
  founder judgment before the term ships.
- **~500+:** (h) *Per-surface reward curves* as defined in §4.2. (i) *Exploration
  yield:* love-rate of exploration-slot impressions vs exploit slots. (j) *Disagreement
  penalty check:* does downweighting measurably reduce skip-after-visit?

---

## 6. Non-goals (permanent, not stage-gated)

- **No LLM extraction, ever** (CLAUDE.md §0). Voiced notes are immutable human text
  for humans; taste signal comes from structured taps (sentiment, tags, dishes, axes).
  No embedding of notes, no semantic layer over quotes.
- **No engagement-maximizing feed.** Reward functions in §4 optimize *went-and-loved*,
  *durable follows*, *return visits* — real-world outcomes, not session length or
  scroll depth. If a metric can be juiced by keeping someone in the app longer, it is
  the wrong metric here.
- **No dark-pattern nudges.** No push (banned in the constitution), no streaks, no
  "X is waiting for you," no algorithm hints at the point of input (the anti-gaming
  rule, spec §3: sentiment buttons never say "trains your taste"). Formula
  transparency stays ingredients-not-coefficients, on the how-it-works surface only.
- **No stars, no public scores, no leaderboards.** The public artifact is the voiced
  note plus who-loved-it. Match percentages surface only above the honest gate, only
  viewer-centric.
- **No popularity ranking.** `placeScore()` stays MAX-over-lovers with log-damped
  support. Global love-counts as a ranking term would recreate the crowd-score product
  this one exists to replace.
- **No embeddings/pgvector/ML pipeline** while plain SQL over 5 floats + tag sets
  answers the question. Revisit only if §4 metrics show content+CF plateauing — and
  then as a decision (ADR), not a drift.
