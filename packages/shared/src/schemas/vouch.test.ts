import { describe, expect, it } from 'vitest';
import {
  VOUCH_CATEGORIES,
  VouchComposerSchema,
  VouchInputSchema,
  VouchTypeSchema,
  looksSpecific,
} from './vouch';

describe('VouchTypeSchema', () => {
  it('is exactly the 6 composer categories (nightlife added)', () => {
    expect(VouchTypeSchema.options).toEqual([
      'stay',
      'eat_drink',
      'do',
      'nightlife',
      'good_to_know',
      'skip',
    ]);
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
      'nightlife',
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

describe('VouchComposerSchema (single vouch → list)', () => {
  it('accepts a single vouch with a destination (default list applied later)', () => {
    const out = VouchComposerSchema.parse({
      vouch_type: 'stay',
      text: 'Banjara, book the tents',
      destination_text: 'Spiti',
    });
    expect(out.list_id).toBeUndefined();
    expect(out.visibility).toBe('friends_of_friends'); // default
  });

  it('rejects an empty vouch text', () => {
    expect(() =>
      VouchComposerSchema.parse({ vouch_type: 'stay', text: '  ', destination_text: 'Spiti' }),
    ).toThrow();
  });

  it('requires a destination', () => {
    expect(() =>
      VouchComposerSchema.parse({ vouch_type: 'do', text: 'Key Monastery at sunrise', destination_text: '  ' }),
    ).toThrow();
  });

  it('accepts an explicit target list or a new list name', () => {
    const a = VouchComposerSchema.parse({
      vouch_type: 'do',
      text: 'Bar Palladio, go early',
      destination_text: 'Jaipur',
      list_id: '00000000-0000-0000-0000-000000000abc',
    });
    expect(a.list_id).toBe('00000000-0000-0000-0000-000000000abc');
    const b = VouchComposerSchema.parse({
      vouch_type: 'stay',
      text: '28 Kothi',
      destination_text: 'Jaipur',
      new_list_name: 'Best heritage stays',
    });
    expect(b.new_list_name).toBe('Best heritage stays');
  });
});

describe('VouchInputSchema', () => {
  it('rejects an empty vouch', () => {
    expect(() => VouchInputSchema.parse({ vouch_type: 'stay', text: '   ' })).toThrow();
  });
});

describe('looksSpecific (soft nudge, never a block)', () => {
  it('flags a lone lowercase common word', () => {
    expect(looksSpecific('nice')).toBe(false);
    expect(looksSpecific('good')).toBe(false);
  });

  it('passes a one-word named place or a number (a real vouch, not vague)', () => {
    expect(looksSpecific('Banjara')).toBe(true); // proper noun
    expect(looksSpecific('Room 412')).toBe(true); // has a number
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
