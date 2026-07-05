import { describe, expect, it } from 'vitest';
import {
  ALL_TASTE_TAGS,
  CATEGORY_PRIORS,
  FORMAT_TAGS,
  OCCASION_TAGS,
  SentimentSchema,
  TASTE_AXES,
  TASTE_TUNING,
  ZERO_AXES,
  blendFingerprint,
  clampAxis,
  cosineAxes,
  inferZone,
  placeScore,
  tasteMatch,
  tasteReadout,
  userTasteAxes,
  weightedJaccard,
} from './taste';

const axes = (over: Partial<Record<(typeof TASTE_AXES)[number], number>> = {}) => ({
  ...ZERO_AXES,
  ...over,
});

describe('vocabulary invariants', () => {
  it('keeps the format vocabulary small (≤ 24, spec §6.3)', () => {
    expect(FORMAT_TAGS.length).toBeLessThanOrEqual(24);
    expect(OCCASION_TAGS.length).toBe(5);
  });

  it('has unique slugs across all tags', () => {
    const slugs = ALL_TASTE_TAGS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('all axis effects and category priors stay mild (|v| ≤ 0.5) and on real axes', () => {
    for (const tag of ALL_TASTE_TAGS) {
      for (const [axis, v] of Object.entries(tag.axisEffects)) {
        expect(TASTE_AXES).toContain(axis);
        expect(Math.abs(v ?? 0)).toBeLessThanOrEqual(0.5);
      }
    }
    for (const prior of Object.values(CATEGORY_PRIORS)) {
      for (const [axis, v] of Object.entries(prior)) {
        expect(TASTE_AXES).toContain(axis);
        expect(Math.abs(v ?? 0)).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('parses sentiments and rejects ratings-shaped values', () => {
    expect(SentimentSchema.parse('loved')).toBe('loved');
    expect(() => SentimentSchema.parse('5-stars')).toThrow();
  });
});

describe('blendFingerprint', () => {
  it('starts from the category prior when there are no votes', () => {
    const fp = blendFingerprint('club', {});
    expect(fp.mellow_lively).toBeCloseTo(0.5);
    expect(fp.substance_scene).toBeCloseTo(0.5);
  });

  it('unknown category → zero prior, and tag shares nudge axes', () => {
    const fp = blendFingerprint(null, { conversation_friendly: 1 });
    expect(fp.mellow_lively).toBeCloseTo(-0.5);
    expect(fp.substance_scene).toBeCloseTo(0);
  });

  it('clamps to [-1, 1] when prior and tags stack', () => {
    const fp = blendFingerprint('club', { dj_dancefloor: 1, big_night_energy: 1 });
    expect(fp.mellow_lively).toBeLessThanOrEqual(1);
    expect(fp.mellow_lively).toBeCloseTo(1); // 0.5 + 0.5 + 0.5 clamped
  });

  it('a curated per-place override wins over the category prior (migration 65)', () => {
    // "restaurant" carries zero prior by design — a curated fingerprint is
    // how a specific venue gets real signal without needing tag votes.
    const withoutOverride = blendFingerprint('restaurant', {});
    expect(withoutOverride).toEqual(ZERO_AXES);

    const curated = axes({ substance_scene: -0.4, refined_unfussy: -0.6 });
    const withOverride = blendFingerprint('restaurant', {}, curated);
    expect(withOverride.substance_scene).toBeCloseTo(-0.4);
    expect(withOverride.refined_unfussy).toBeCloseTo(-0.6);
  });
});

describe('userTasteAxes', () => {
  it('is zero with no signal', () => {
    expect(userTasteAxes([])).toEqual(ZERO_AXES);
  });

  it('averages loved places and pulls away from skips at half strength', () => {
    const v = userTasteAxes([
      { placeAxes: axes({ mellow_lively: 1 }), sentiment: 'loved', ageDays: 0 },
      { placeAxes: axes({ mellow_lively: 1 }), sentiment: 'skip', ageDays: 0 },
    ]);
    // (1·1 + (−0.5)·1) / (1 + 0.5) = 0.333…
    expect(v.mellow_lively).toBeCloseTo(1 / 3);
  });

  it("ignores 'fine' entirely", () => {
    const v = userTasteAxes([
      { placeAxes: axes({ value_splurge: 1 }), sentiment: 'fine', ageDays: 0 },
    ]);
    expect(v).toEqual(ZERO_AXES);
  });

  it('decays with age at the configured half-life', () => {
    const fresh = userTasteAxes([
      { placeAxes: axes({ substance_scene: -1 }), sentiment: 'loved', ageDays: 0 },
      {
        placeAxes: axes({ substance_scene: 1 }),
        sentiment: 'loved',
        ageDays: TASTE_TUNING.reactionHalfLifeDays,
      },
    ]);
    // fresh −1 at weight 1, old +1 at weight 0.5 → (−1 + 0.5)/1.5 = −1/3
    expect(fresh.substance_scene).toBeCloseTo(-1 / 3);
  });

  it('folds onboarding priors in as a weighted pseudo-observation', () => {
    const v = userTasteAxes(
      [{ placeAxes: axes({ mellow_lively: 1 }), sentiment: 'loved', ageDays: 0 }],
      { mellow_lively: -1 },
    );
    // (1·1 + 2·(−1)) / (1 + 2) = −1/3
    expect(v.mellow_lively).toBeCloseTo(-1 / 3);
  });

  it('a zero-signal love on one axis does not dilute a strong prior on another axis (migration 65 fix)', () => {
    // Reproduces the live bug: a ±0.5 quiz prior on substance_scene, then
    // loving a handful of places with NO signal on substance_scene (the
    // exact shape of the seed corpus before per-place fingerprinting).
    // Before the per-axis fix, the shared scalar denominator meant these
    // zero-signal loves diluted substance_scene toward zero even though
    // none of them said anything about it.
    const zeroSignalLoves = Array.from({ length: 5 }, () => ({
      placeAxes: axes({ mellow_lively: 0.3 }), // signal on a DIFFERENT axis only
      sentiment: 'loved' as const,
      ageDays: 0,
    }));
    const v = userTasteAxes(zeroSignalLoves, { substance_scene: -0.5 });
    // substance_scene had NO reactions carrying signal on it — only the
    // prior — so it should equal the prior exactly, undiluted.
    expect(v.substance_scene).toBeCloseTo(-0.5);
  });

  it('a place is still zero on an axis it genuinely has no opinion on', () => {
    // No prior, no other signal at all on this axis → stays exactly 0,
    // not some leftover artifact of the per-axis change.
    const v = userTasteAxes([
      { placeAxes: axes({ mellow_lively: 1 }), sentiment: 'loved', ageDays: 0 },
    ]);
    expect(v.substance_scene).toBe(0);
  });
});

describe('match math', () => {
  it('cosine: identical direction = 1, orthogonal = 0, zero vector = 0', () => {
    expect(cosineAxes(axes({ mellow_lively: 1 }), axes({ mellow_lively: 0.5 }))).toBeCloseTo(1);
    expect(cosineAxes(axes({ mellow_lively: 1 }), axes({ value_splurge: 1 }))).toBeCloseTo(0);
    expect(cosineAxes(ZERO_AXES, axes({ mellow_lively: 1 }))).toBe(0);
  });

  it('weighted Jaccard: identical = 1, disjoint = 0, empty = 0', () => {
    expect(weightedJaccard({ a: 2, b: 1 }, { a: 2, b: 1 })).toBe(1);
    expect(weightedJaccard({ a: 1 }, { b: 1 })).toBe(0);
    expect(weightedJaccard({}, {})).toBe(0);
  });

  it('tasteMatch stays in [0, 1] and floors opposed tastes at 0', () => {
    const opposed = tasteMatch(axes({ mellow_lively: 1 }), axes({ mellow_lively: -1 }), {}, {});
    expect(opposed).toBe(0);
    const twin = tasteMatch(
      axes({ mellow_lively: 1 }),
      axes({ mellow_lively: 1 }),
      { a: 1 },
      { a: 1 },
    );
    expect(twin).toBeCloseTo(1);
  });
});

describe('placeScore', () => {
  it('is taste-led: one perfect-match lover beats many weak ones', () => {
    const onePerfect = placeScore([{ match: 1, ageDays: 0, followed: false }]);
    const manyWeak = placeScore(
      Array.from({ length: 40 }, () => ({ match: null, ageDays: 0, followed: false })),
    );
    expect(onePerfect).toBeGreaterThan(manyWeak);
  });

  it('applies the follow boost and monotonically grows with support', () => {
    const followed = placeScore([{ match: 0.5, ageDays: 0, followed: true }]);
    const not = placeScore([{ match: 0.5, ageDays: 0, followed: false }]);
    expect(followed).toBeCloseTo(not * TASTE_TUNING.followBoost);

    const one = placeScore([{ match: 0.8, ageDays: 0, followed: false }]);
    const two = placeScore([
      { match: 0.8, ageDays: 0, followed: false },
      { match: 0.6, ageDays: 0, followed: false },
    ]);
    expect(two).toBeGreaterThan(one);
  });

  it('empty lovers → 0', () => {
    expect(placeScore([])).toBe(0);
  });
});

describe('tasteReadout', () => {
  it('names only the axes with a clear lean when confident', () => {
    const lines = tasteReadout(axes({ substance_scene: -0.6, value_splurge: 0.3 }));
    expect(lines).toContain('substance-first');
    expect(lines).toContain('splurges on the right thing');
    expect(lines.length).toBe(2);
  });

  it('never goes silent on weak-but-real signal (migration 65 fix)', () => {
    // Below the ±0.25 confident threshold on every axis, but genuinely
    // non-zero — exactly the founder's live shape post-dilution-fix
    // (small residual signal, nothing crossing confident yet).
    const lines = tasteReadout(axes({ substance_scene: -0.12, value_splurge: 0.08 }));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines).toContain('leans substance over scene');
  });

  it('ranks the strongest lean first and caps at two', () => {
    const lines = tasteReadout(
      axes({ substance_scene: -0.2, mellow_lively: 0.15, adventurous_trusty: 0.05 }),
    );
    expect(lines).toEqual(['leans substance over scene', 'leans high-energy']);
  });

  it('says nothing for a genuinely all-zero vector (never logged, no priors)', () => {
    expect(tasteReadout(ZERO_AXES)).toEqual([]);
  });
});

describe('clampAxis', () => {
  it('clamps to [-1, 1]', () => {
    expect(clampAxis(2)).toBe(1);
    expect(clampAxis(-2)).toBe(-1);
    expect(clampAxis(0.3)).toBe(0.3);
  });
});

describe('inferZone', () => {
  it('maps known Gurgaon venues to gurgaon', () => {
    expect(inferZone(28.457, 77.09)).toBe('gurgaon'); // Comorin, GCR
    expect(inferZone(28.4814, 77.104)).toBe('gurgaon'); // The Kitchens, Sector 26
    expect(inferZone(28.38, 77.05)).toBe('gurgaon'); // Sec 68 / Airia
  });
  it('maps known Delhi areas to delhi', () => {
    expect(inferZone(28.6, 77.227)).toBe('delhi'); // Khan Market
    expect(inferZone(28.514, 77.178)).toBe('delhi'); // Mehrauli
  });
  it('keeps the Gurgaon border zone gurgaon (box order)', () => {
    expect(inferZone(28.481, 77.104)).toBe('gurgaon'); // Sikanderpur/MG Rd
  });
  it('returns null for out-of-market and missing coords', () => {
    expect(inferZone(9.535, 100.062)).toBeNull(); // Chaweng Beach
    expect(inferZone(13.75, 100.5)).toBeNull(); // Bangkok
    expect(inferZone(28.35, 77.31)).toBeNull(); // Faridabad — not a v1 zone
    expect(inferZone(null, 77.1)).toBeNull();
    expect(inferZone(28.45, undefined)).toBeNull();
  });
});
