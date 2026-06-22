import { describe, expect, it } from 'vitest';
import {
  TripComposerSchema,
  VOUCH_CATEGORIES,
  VouchInputSchema,
  VouchTypeSchema,
  looksSpecific,
} from './vouch';

describe('VouchTypeSchema', () => {
  it('is exactly the 5 composer categories', () => {
    expect(VouchTypeSchema.options).toEqual(['stay', 'eat_drink', 'do', 'good_to_know', 'skip']);
  });

  it('rejects extraction-era advice types', () => {
    expect(() => VouchTypeSchema.parse('ask_contact')).toThrow();
    expect(() => VouchTypeSchema.parse('book')).toThrow();
  });
});

describe('VOUCH_CATEGORIES', () => {
  it('has one entry per vouch_type, in composer order', () => {
    expect(VOUCH_CATEGORIES.map((c) => c.type)).toEqual([
      'stay',
      'eat_drink',
      'do',
      'good_to_know',
      'skip',
    ]);
  });

  it('every category ships a voiced placeholder example', () => {
    for (const c of VOUCH_CATEGORIES) {
      expect(c.placeholder.length).toBeGreaterThan(0);
    }
  });
});

describe('TripComposerSchema', () => {
  it('accepts a trip with one vouch (a user with only a hotel rec)', () => {
    const out = TripComposerSchema.parse({
      destination_text: 'Spiti',
      verdict: 'love',
      vouches: [{ vouch_type: 'stay', text: 'Banjara, book the tents' }],
    });
    expect(out.vouches).toHaveLength(1);
    expect(out.visibility).toBe('friends_of_friends'); // default
  });

  it('rejects a trip with zero vouches (helps no one)', () => {
    expect(() =>
      TripComposerSchema.parse({ destination_text: 'Goa', verdict: 'love', vouches: [] }),
    ).toThrow();
  });

  it('requires a verdict', () => {
    expect(() =>
      TripComposerSchema.parse({
        destination_text: 'Goa',
        vouches: [{ vouch_type: 'stay', text: 'x place' }],
      }),
    ).toThrow();
  });

  it('requires a destination', () => {
    expect(() =>
      TripComposerSchema.parse({
        destination_text: '  ',
        verdict: 'mid',
        vouches: [{ vouch_type: 'do', text: 'Key Monastery at sunrise' }],
      }),
    ).toThrow();
  });
});

describe('VouchInputSchema', () => {
  it('rejects an empty vouch', () => {
    expect(() => VouchInputSchema.parse({ vouch_type: 'stay', text: '   ' })).toThrow();
  });
});

describe('looksSpecific (soft nudge, never a block)', () => {
  it('flags one-word vouches', () => {
    expect(looksSpecific('nice')).toBe(false);
    expect(looksSpecific('Banjara')).toBe(false);
  });

  it('passes multi-word voiced vouches', () => {
    expect(looksSpecific('Banjara, book the tents')).toBe(true);
    expect(looksSpecific('Skip Kaza unless you need supplies')).toBe(true);
  });

  it('treats empty (not-yet-answered) as fine — no nagging', () => {
    expect(looksSpecific('')).toBe(true);
    expect(looksSpecific('   ')).toBe(true);
  });
});
