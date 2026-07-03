import { deriveTrustProfile, joinContexts, knownForTail, trustContextLabel } from './trust-context';

describe('trustContextLabel', () => {
  it('maps each vouch_type to a sentence-ready label', () => {
    expect(trustContextLabel('stay')).toBe('stays');
    expect(trustContextLabel('eat_drink')).toBe('food');
    expect(trustContextLabel('nightlife')).toBe('nightlife');
    expect(trustContextLabel('good_to_know')).toBe('local know-how');
  });
});

describe('deriveTrustProfile', () => {
  it('returns null when there are no vouches (caller suppresses the line)', () => {
    expect(deriveTrustProfile([])).toBeNull();
  });

  it('ranks contexts by count and caps at two', () => {
    const p = deriveTrustProfile([
      { vouch_type: 'eat_drink', destination_text: 'Goa' },
      { vouch_type: 'eat_drink', destination_text: 'Goa' },
      { vouch_type: 'stay', destination_text: 'Goa' },
      { vouch_type: 'do', destination_text: 'Goa' },
    ]);
    expect(p).not.toBeNull();
    // food (2) leads; stay & do tie at 1 — only the top two kinds survive.
    expect(p?.contexts[0]).toBe('food');
    expect(p?.contexts.length).toBe(2);
    expect(p?.vouchCount).toBe(4);
  });

  it("excludes 'skip' from contexts but still counts it in the total", () => {
    const p = deriveTrustProfile([
      { vouch_type: 'skip', destination_text: 'Kaza' },
      { vouch_type: 'stay', destination_text: 'Kaza' },
    ]);
    expect(p?.contexts).toEqual(['stays']);
    expect(p?.vouchCount).toBe(2);
  });

  it('tallies the top destination and distinct destination count', () => {
    const p = deriveTrustProfile([
      { vouch_type: 'stay', destination_text: 'Goa' },
      { vouch_type: 'stay', destination_text: 'Goa' },
      { vouch_type: 'eat_drink', destination_text: 'Tokyo' },
    ]);
    expect(p?.topDestination).toBe('Goa');
    expect(p?.destinationCount).toBe(2);
  });
});

describe('joinContexts', () => {
  it('joins one or two contexts and falls back when empty', () => {
    expect(joinContexts(['stays'])).toBe('stays');
    expect(joinContexts(['stays', 'food'])).toBe('stays & food');
    expect(joinContexts([])).toBe('local know-how');
  });
});

describe('knownForTail', () => {
  it('uses "in {place}" for a single destination', () => {
    const p = deriveTrustProfile([
      { vouch_type: 'stay', destination_text: 'Goa' },
      { vouch_type: 'eat_drink', destination_text: 'Goa' },
    ]);
    if (!p) throw new Error('expected a trust profile');
    expect(knownForTail(p)).toBe('stays & food in Goa');
  });

  it('summarises the place count across many destinations', () => {
    const p = deriveTrustProfile([
      { vouch_type: 'stay', destination_text: 'Goa' },
      { vouch_type: 'stay', destination_text: 'Tokyo' },
      { vouch_type: 'stay', destination_text: 'Lisbon' },
    ]);
    if (!p) throw new Error('expected a trust profile');
    expect(knownForTail(p)).toBe('stays · 3 places');
  });
});
