import { describe, expect, it } from 'vitest';
import { isLikelyValidPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('strips spaces, parens, hyphens', () => {
    expect(normalizePhone('+91 (98) 7654-3210')).toBe('+919876543210');
  });

  it('returns empty string for empty input', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone('   ')).toBe('');
  });

  it('preserves a leading plus', () => {
    expect(normalizePhone('+919876543210')).toBe('+919876543210');
  });

  it('adds a leading plus when caller forgot one', () => {
    expect(normalizePhone('919876543210')).toBe('+919876543210');
  });
});

describe('isLikelyValidPhone', () => {
  it('accepts E.164 strings', () => {
    expect(isLikelyValidPhone('+919876543210')).toBe(true);
    expect(isLikelyValidPhone('+14155552671')).toBe(true);
  });

  it('rejects too-short or too-long numbers', () => {
    expect(isLikelyValidPhone('+1234')).toBe(false);
    expect(isLikelyValidPhone(`+${'1'.repeat(16)}`)).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isLikelyValidPhone('')).toBe(false);
  });
});
