import { describe, expect, it } from 'vitest';
import {
  AdviceTypeSchema,
  ComposerFormSchema,
  ExtractionResultSchema,
  LogTipDraftSchema,
  TripVerdictSchema,
} from './log-tip';

describe('ComposerFormSchema', () => {
  it('accepts a minimal valid composer note', () => {
    const out = ComposerFormSchema.parse({
      destination_text: 'Spiti',
      original_note: 'Stay at Banjara, book the tents.',
    });
    expect(out.destination_text).toBe('Spiti');
    expect(out.visibility).toBe('friends_of_friends'); // default applied
  });

  it('rejects an empty destination', () => {
    expect(() =>
      ComposerFormSchema.parse({ destination_text: '   ', original_note: 'x' }),
    ).toThrow();
  });

  it('rejects an empty note (no minimum word count, but must be non-empty)', () => {
    expect(() =>
      ComposerFormSchema.parse({ destination_text: 'Goa', original_note: '   ' }),
    ).toThrow();
  });

  it('accepts an optional one-tap verdict', () => {
    const out = ComposerFormSchema.parse({
      destination_text: 'Goa',
      original_note: 'Stay in Assagao.',
      verdict: 'love',
    });
    expect(out.verdict).toBe('love');
  });
});

describe('LogTipDraftSchema', () => {
  it('accepts a placeless skip tip (the kind reviews cannot represent)', () => {
    const out = LogTipDraftSchema.parse({
      text: 'Skip Kaza unless you need supplies',
      advice_type: 'skip',
      confidence: 0.91,
    });
    expect(out.advice_type).toBe('skip');
    expect(out.place_candidate).toBeUndefined();
  });

  it('rejects an out-of-range confidence', () => {
    expect(() =>
      LogTipDraftSchema.parse({ text: 'x', advice_type: 'stay', confidence: 1.4 }),
    ).toThrow();
  });

  it('rejects an unknown advice_type', () => {
    expect(() =>
      LogTipDraftSchema.parse({ text: 'x', advice_type: 'review', confidence: 0.5 }),
    ).toThrow();
  });
});

describe('ExtractionResultSchema', () => {
  it('accepts an empty tips array (triggers the composer nudge, not a block)', () => {
    const out = ExtractionResultSchema.parse({
      destination_text: 'Goa',
      original_note: 'It was nice.',
      tips: [],
    });
    expect(out.tips).toHaveLength(0);
  });

  it('parses the canonical Spiti example into four tips', () => {
    const out = ExtractionResultSchema.parse({
      destination_text: 'Spiti',
      original_note:
        'Stay at Banjara and book the tents. Skip Kaza unless you need supplies. Ask for Tashi for the monastery day.',
      tips: [
        { text: 'Stay at Banjara', advice_type: 'stay', place_candidate: 'Banjara', confidence: 0.82 },
        { text: 'Book the tents', advice_type: 'book', place_candidate: 'Banjara', confidence: 0.68 },
        { text: 'Skip Kaza unless you need supplies', advice_type: 'skip', area_text: 'Kaza', confidence: 0.91 },
        { text: 'Ask for Tashi for the monastery day', advice_type: 'ask_contact', confidence: 0.77 },
      ],
    });
    expect(out.tips.map((t) => t.advice_type)).toEqual(['stay', 'book', 'skip', 'ask_contact']);
  });
});

describe('enums', () => {
  it('AdviceType covers the placeless advice kinds', () => {
    for (const t of ['skip', 'avoid', 'ask_contact', 'area'] as const) {
      expect(AdviceTypeSchema.parse(t)).toBe(t);
    }
  });

  it('TripVerdict mirrors the DB verdict_kind enum', () => {
    expect(TripVerdictSchema.options).toEqual(['love', 'mid', 'skip']);
  });
});
