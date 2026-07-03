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
  it('names only the axes with a clear lean', () => {
    const lines = tasteReadout(axes({ substance_scene: -0.6, value_splurge: 0.3 }));
    expect(lines).toContain('substance-first');
    expect(lines).toContain('splurges on the right thing');
    expect(lines.length).toBe(2);
  });
});

describe('clampAxis', () => {
  it('clamps to [-1, 1]', () => {
    expect(clampAxis(2)).toBe(1);
    expect(clampAxis(-2)).toBe(-1);
    expect(clampAxis(0.3)).toBe(0.3);
  });
});
