import { z } from 'zod';

/**
 * Taste engine — single source of truth (docs/taste-pivot-spec.md §2).
 *
 * The move: tag PLACES lightly; a person's taste = the recency-weighted average
 * of the places they loved. No self-description, no user×place collaborative
 * filtering, no ML. Five bipolar axes + two tag layers.
 *
 * PARITY CONTRACT: supabase/migrations/00000000000056_taste_vocab_seed.sql
 * seeds the DB copies of CATEGORY_PRIORS and TASTE_TAGS from these values, and
 * the SQL functions in migration 55 mirror the math below. If you change
 * anything here, ship a data migration updating the DB copies in the same PR.
 */

// ---------------------------------------------------------------------------
// Axes. Convention: an axis named `a_b` runs -1 = fully `a` … +1 = fully `b`.
// ---------------------------------------------------------------------------

export const TASTE_AXES = [
  'substance_scene', // is the point the food/drink itself (-1) or the atmosphere/being-out (+1)
  'mellow_lively', // quiet/intimate (-1) vs loud/high-energy (+1)
  'adventurous_trusty', // chases the new/unfamiliar (-1) vs goes where it's proven (+1)
  'refined_unfussy', // polished/elevated (-1) vs casual/rough-edged (+1)
  'value_splurge', // value-hunting (-1) vs pays happily for the right thing (+1)
] as const;
export type TasteAxis = (typeof TASTE_AXES)[number];
export type TasteAxes = Record<TasteAxis, number>;

export const ZERO_AXES: TasteAxes = {
  substance_scene: 0,
  mellow_lively: 0,
  adventurous_trusty: 0,
  refined_unfussy: 0,
  value_splurge: 0,
};

export const SentimentSchema = z.enum(['loved', 'fine', 'skip']);
export type Sentiment = z.infer<typeof SentimentSchema>;

// ---------------------------------------------------------------------------
// Tunables — one place, mirrored in SQL.
// ---------------------------------------------------------------------------

export const TASTE_TUNING = {
  /** Recency half-life (days) for reactions when building a user vector. */
  reactionHalfLifeDays: 180,
  /** Weight of a 'skip' relative to a 'loved' (negative pull). */
  skipWeight: -0.5,
  /** Weight of the onboarding either/or priors, in "loved-place equivalents". */
  priorWeight: 2,
  /** Axes vs tags split in the person↔person match. */
  matchAxesWeight: 0.7,
  matchTagsWeight: 0.3,
  /** Both sides need this many loves before a match is shown/used. */
  confidenceMinLoves: 8,
  /** Ranking boost when the viewer follows the lover. */
  followBoost: 1.3,
  /** λ for the diminishing-returns support term in place scoring. */
  supportLambda: 0.15,
  /** Fallback lover weight when no taste match exists (tribe tier). */
  tribeWeight: 0.35,
  /**
   * PRIVACY + SKIP SIGNAL (asymmetric match, migration 58): the cross-user
   * match uses the VIEWER's FULL vector (loves + their own skips at skipWeight
   * + onboarding priors — zero leak, it's their own data, shown only to them)
   * against the OTHER side's LOVES-ONLY vector. The target's skips/priors must
   * never enter the externally-observable scalar, or they become
   * reconstructable by vector-steering. Consequence: match(A→B) ≠ match(B→A),
   * which is correct — "fit to YOU" is viewer-centric.
   */
  matchOtherSideLovesOnly: true,
} as const;

// ---------------------------------------------------------------------------
// Occasions (gate the query — not taste traits).
// ---------------------------------------------------------------------------

export const OCCASIONS = ['solo_coffee', 'date', 'small_group', 'big_night', 'late_night'] as const;
export type Occasion = (typeof OCCASIONS)[number];

// ---------------------------------------------------------------------------
// Category priors — a place is never blank; its Google-ish category seeds the
// fingerprint before any human tags it. Values are deliberately mild (±0.5 max)
// so crowd tags can move them.
// ---------------------------------------------------------------------------

export const CATEGORY_PRIORS: Record<string, Partial<TasteAxes>> = {
  restaurant: {},
  fine_dining: {
    substance_scene: -0.3,
    refined_unfussy: -0.5,
    value_splurge: 0.5,
    mellow_lively: -0.2,
  },
  cafe: { substance_scene: -0.2, mellow_lively: -0.4, value_splurge: -0.2 },
  bakery_dessert: { substance_scene: -0.3, mellow_lively: -0.3, value_splurge: -0.1 },
  street_food: { substance_scene: -0.5, refined_unfussy: 0.5, value_splurge: -0.5 },
  bar: { substance_scene: 0.2, mellow_lively: 0.2 },
  cocktail_bar: {
    substance_scene: 0.1,
    mellow_lively: 0.1,
    refined_unfussy: -0.3,
    value_splurge: 0.3,
  },
  brewery: { substance_scene: 0.2, mellow_lively: 0.3, refined_unfussy: 0.3, value_splurge: -0.1 },
  club: { substance_scene: 0.5, mellow_lively: 0.5, value_splurge: 0.3 },
  live_music: { substance_scene: 0.3, mellow_lively: 0.3 },
};

// ---------------------------------------------------------------------------
// Format tags — the crowd's 2–3 optional taps at log time. Each tag can nudge
// the place fingerprint (axisEffects, applied by vote share). NCR-tuned v1
// vocabulary; ≤ ~24 by design (spec §6.3).
// ---------------------------------------------------------------------------

export type TasteTag = {
  slug: string;
  kind: 'format' | 'occasion';
  label: string;
  axisEffects: Partial<TasteAxes>;
};

export const FORMAT_TAGS: TasteTag[] = [
  {
    slug: 'regional_indian',
    kind: 'format',
    label: 'Regional Indian',
    axisEffects: { substance_scene: -0.3, adventurous_trusty: -0.2 },
  },
  { slug: 'north_indian', kind: 'format', label: 'North Indian', axisEffects: {} },
  { slug: 'pan_asian', kind: 'format', label: 'Pan-Asian', axisEffects: {} },
  {
    slug: 'japanese_izakaya',
    kind: 'format',
    label: 'Japanese / izakaya',
    axisEffects: { substance_scene: -0.2, adventurous_trusty: -0.2 },
  },
  { slug: 'european', kind: 'format', label: 'European', axisEffects: {} },
  { slug: 'middle_eastern', kind: 'format', label: 'Middle Eastern', axisEffects: {} },
  {
    slug: 'small_plates',
    kind: 'format',
    label: 'Small plates',
    axisEffects: { substance_scene: -0.2 },
  },
  {
    slug: 'tasting_menu',
    kind: 'format',
    label: 'Tasting menu',
    axisEffects: { substance_scene: -0.4, refined_unfussy: -0.4, value_splurge: 0.5 },
  },
  {
    slug: 'street_food',
    kind: 'format',
    label: 'Street food',
    axisEffects: { substance_scene: -0.4, refined_unfussy: 0.5, value_splurge: -0.5 },
  },
  {
    slug: 'specialty_coffee',
    kind: 'format',
    label: 'Specialty coffee',
    axisEffects: { substance_scene: -0.4, mellow_lively: -0.3 },
  },
  { slug: 'dessert', kind: 'format', label: 'Dessert', axisEffects: {} },
  {
    slug: 'cocktail_forward',
    kind: 'format',
    label: 'Cocktail-forward',
    axisEffects: { substance_scene: -0.1, value_splurge: 0.2 },
  },
  {
    slug: 'natural_wine',
    kind: 'format',
    label: 'Natural wine',
    axisEffects: { substance_scene: -0.2, adventurous_trusty: -0.3, mellow_lively: -0.2 },
  },
  {
    slug: 'craft_beer',
    kind: 'format',
    label: 'Craft beer',
    axisEffects: { refined_unfussy: 0.2 },
  },
  {
    slug: 'dive_energy',
    kind: 'format',
    label: 'Dive energy',
    axisEffects: { refined_unfussy: 0.5, value_splurge: -0.3, substance_scene: 0.1 },
  },
  {
    slug: 'rooftop_view',
    kind: 'format',
    label: 'Rooftop / view',
    axisEffects: { substance_scene: 0.4 },
  },
  {
    slug: 'live_music',
    kind: 'format',
    label: 'Live music',
    axisEffects: { substance_scene: 0.3, mellow_lively: 0.3 },
  },
  {
    slug: 'dj_dancefloor',
    kind: 'format',
    label: 'DJ / dancefloor',
    axisEffects: { substance_scene: 0.4, mellow_lively: 0.5 },
  },
  {
    slug: 'big_night_energy',
    kind: 'format',
    label: 'Big-night energy',
    axisEffects: { mellow_lively: 0.5, substance_scene: 0.3 },
  },
  { slug: 'date_spot', kind: 'format', label: 'Date spot', axisEffects: { mellow_lively: -0.3 } },
  {
    slug: 'conversation_friendly',
    kind: 'format',
    label: 'You can actually talk',
    axisEffects: { mellow_lively: -0.5 },
  },
  {
    slug: 'chefs_place',
    kind: 'format',
    label: "Chef's place",
    axisEffects: { substance_scene: -0.4, adventurous_trusty: -0.2 },
  },
  {
    slug: 'old_reliable',
    kind: 'format',
    label: 'Old reliable',
    axisEffects: { adventurous_trusty: 0.5 },
  },
  {
    slug: 'new_opening',
    kind: 'format',
    label: 'New opening',
    axisEffects: { adventurous_trusty: -0.4 },
  },
];

export const OCCASION_TAGS: TasteTag[] = [
  { slug: 'solo_coffee', kind: 'occasion', label: 'Solo / coffee', axisEffects: {} },
  { slug: 'date', kind: 'occasion', label: 'Date', axisEffects: {} },
  { slug: 'small_group', kind: 'occasion', label: 'Small group', axisEffects: {} },
  { slug: 'big_night', kind: 'occasion', label: 'Big night', axisEffects: {} },
  { slug: 'late_night', kind: 'occasion', label: 'Late night', axisEffects: {} },
];

export const ALL_TASTE_TAGS: TasteTag[] = [...FORMAT_TAGS, ...OCCASION_TAGS];

// ---------------------------------------------------------------------------
// Math. Pure, mirrored by the SQL in migration 55.
// ---------------------------------------------------------------------------

export const clampAxis = (v: number): number => Math.max(-1, Math.min(1, v));

/** Place fingerprint = category prior + Σ (tag vote-share · tag axis effect), clamped. */
export function blendFingerprint(
  category: string | null,
  tagVoteShares: Record<string, number>, // slug -> share of the place's voters (0..1)
): TasteAxes {
  const prior = (category && CATEGORY_PRIORS[category]) || {};
  const out: TasteAxes = { ...ZERO_AXES, ...prior };
  for (const [slug, share] of Object.entries(tagVoteShares)) {
    const tag = ALL_TASTE_TAGS.find((t) => t.slug === slug);
    if (!tag) continue;
    for (const [axis, effect] of Object.entries(tag.axisEffects)) {
      out[axis as TasteAxis] += (effect ?? 0) * share;
    }
  }
  for (const axis of TASTE_AXES) out[axis] = clampAxis(out[axis]);
  return out;
}

export type ReactionForVector = {
  placeAxes: TasteAxes;
  sentiment: Sentiment;
  ageDays: number;
};

/**
 * User taste vector: recency-weighted mean of loved-place axes, with skips
 * pulling away at half strength and 'fine' contributing nothing. Onboarding
 * priors fold in as a pseudo-observation of weight `priorWeight`.
 */
export function userTasteAxes(
  reactions: ReactionForVector[],
  onboardingPriors: Partial<TasteAxes> | null = null,
): TasteAxes {
  const { reactionHalfLifeDays, skipWeight, priorWeight } = TASTE_TUNING;
  const sum: TasteAxes = { ...ZERO_AXES };
  let totalWeight = 0;
  for (const r of reactions) {
    const s = r.sentiment === 'loved' ? 1 : r.sentiment === 'skip' ? skipWeight : 0;
    if (s === 0) continue;
    const w = s * 2 ** (-r.ageDays / reactionHalfLifeDays);
    for (const axis of TASTE_AXES) sum[axis] += w * r.placeAxes[axis];
    totalWeight += Math.abs(w);
  }
  if (onboardingPriors) {
    for (const axis of TASTE_AXES) sum[axis] += priorWeight * (onboardingPriors[axis] ?? 0);
    totalWeight += priorWeight;
  }
  if (totalWeight === 0) return { ...ZERO_AXES };
  const out: TasteAxes = { ...ZERO_AXES };
  for (const axis of TASTE_AXES) out[axis] = clampAxis(sum[axis] / totalWeight);
  return out;
}

export function cosineAxes(a: TasteAxes, b: TasteAxes): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const axis of TASTE_AXES) {
    dot += a[axis] * b[axis];
    na += a[axis] ** 2;
    nb += b[axis] ** 2;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Weighted Jaccard over tag-frequency profiles (slug -> weight ≥ 0). */
export function weightedJaccard(a: Record<string, number>, b: Record<string, number>): number {
  const slugs = new Set([...Object.keys(a), ...Object.keys(b)]);
  let minSum = 0;
  let maxSum = 0;
  for (const slug of slugs) {
    const av = a[slug] ?? 0;
    const bv = b[slug] ?? 0;
    minSum += Math.min(av, bv);
    maxSum += Math.max(av, bv);
  }
  if (maxSum === 0) return 0;
  return minSum / maxSum;
}

/** Person↔person match, 0..1. Negative-cosine (opposed tastes) floors at 0. */
export function tasteMatch(
  axesA: TasteAxes,
  axesB: TasteAxes,
  tagsA: Record<string, number>,
  tagsB: Record<string, number>,
): number {
  const { matchAxesWeight, matchTagsWeight } = TASTE_TUNING;
  const raw =
    matchAxesWeight * cosineAxes(axesA, axesB) + matchTagsWeight * weightedJaccard(tagsA, tagsB);
  return Math.max(0, Math.min(1, raw));
}

export type LoverForScore = {
  /** taste match viewer↔lover (0..1), or null when below the confidence gate */
  match: number | null;
  ageDays: number;
  followed: boolean;
};

/**
 * Place score for a query: MAX over lovers (taste-led, never popularity) plus a
 * mild diminishing-returns support term over the remaining lovers.
 */
export function placeScore(lovers: LoverForScore[]): number {
  const { reactionHalfLifeDays, followBoost, supportLambda, tribeWeight } = TASTE_TUNING;
  const weights = lovers
    .map((l) => {
      const base = l.match ?? tribeWeight;
      const recency = 2 ** (-l.ageDays / reactionHalfLifeDays);
      return base * recency * (l.followed ? followBoost : 1);
    })
    .sort((x, y) => y - x);
  if (weights.length === 0) return 0;
  const [top, ...rest] = weights;
  return (top ?? 0) + supportLambda * Math.log(1 + rest.reduce((s, w) => s + w, 0));
}

/** Human-readable taste line for a profile ("substance-first · adventurous · splurges"). */
export function tasteReadout(axes: TasteAxes): string[] {
  const out: string[] = [];
  const say = (axis: TasteAxis, neg: string, pos: string, threshold = 0.25) => {
    const v = axes[axis];
    if (v <= -threshold) out.push(neg);
    else if (v >= threshold) out.push(pos);
  };
  say('substance_scene', 'substance-first', 'scene-first');
  say('mellow_lively', 'keeps it mellow', 'high-energy');
  say('adventurous_trusty', 'chases the new', 'sticks to the proven');
  say('refined_unfussy', 'likes it polished', 'happily unfussy');
  say('value_splurge', 'value-hunter', 'splurges on the right thing');
  return out;
}

// ---------------------------------------------------------------------------
// Beachhead geography (spec §4b). NCR is polycentric — "area" = named hub
// chips, not GPS radius. Phase 0 = entire Gurgaon (one going-out market,
// ~6–8 hubs); South Delhi = Phase 0.5, same graph, second zone.
// ---------------------------------------------------------------------------

export type Hub = { slug: string; label: string; zone: 'gurgaon' | 'delhi' };

export const GURGAON_HUBS: Hub[] = [
  { slug: '32nd_ave', label: '32nd Avenue', zone: 'gurgaon' },
  { slug: 'cyberhub', label: 'CyberHub', zone: 'gurgaon' },
  { slug: 'gcr', label: 'Golf Course Rd', zone: 'gurgaon' },
  { slug: 'gc_ext', label: 'GC Extension', zone: 'gurgaon' },
  { slug: 'm3m_ifc', label: 'M3M IFC', zone: 'gurgaon' },
  { slug: 'worldmark_65', label: 'Worldmark 65', zone: 'gurgaon' },
  { slug: 'sector_29', label: 'Sector 29', zone: 'gurgaon' },
  { slug: 'galleria', label: 'Galleria', zone: 'gurgaon' },
  { slug: 'crosspoint', label: 'Cross Point', zone: 'gurgaon' },
  { slug: 'south_point', label: 'South Point', zone: 'gurgaon' },
  { slug: 'mg_road', label: 'MG Road', zone: 'gurgaon' },
  { slug: 'kitchens', label: 'The Kitchens', zone: 'gurgaon' },
  { slug: 'sohna_road', label: 'Sohna Road', zone: 'gurgaon' },
  { slug: 'sector_68_airia', label: 'Sec 68 / Airia', zone: 'gurgaon' },
  { slug: 'udyog_vihar', label: 'Udyog Vihar', zone: 'gurgaon' },
];

export const DELHI_HUBS: Hub[] = [
  { slug: 'mehrauli', label: 'Mehrauli / Dhan Mill', zone: 'delhi' },
  { slug: 'khan_market', label: 'Khan Market', zone: 'delhi' },
  { slug: 'gk2', label: 'GK-2', zone: 'delhi' },
];

export const ALL_HUBS: Hub[] = [...GURGAON_HUBS, ...DELHI_HUBS];

/**
 * Map a place category to the legacy vouch_type so a voiced note written from
 * the Log screen lands in the existing vouches table coherently.
 */
export function categoryToVouchType(category: string | null): 'eat_drink' | 'nightlife' | 'do' {
  switch (category) {
    case 'bar':
    case 'cocktail_bar':
    case 'brewery':
    case 'club':
    case 'live_music':
      return 'nightlife';
    case 'restaurant':
    case 'fine_dining':
    case 'cafe':
    case 'bakery_dessert':
    case 'street_food':
      return 'eat_drink';
    default:
      return 'do';
  }
}
