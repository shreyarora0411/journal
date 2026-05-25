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

  describe('defaultCountryCode (contact-import path)', () => {
    it('prepends +91 for a bare 10-digit Indian local number', () => {
      expect(normalizePhone('9876543210', 'IN')).toBe('+919876543210');
      expect(normalizePhone('98765 43210', 'IN')).toBe('+919876543210');
    });

    it('does NOT apply the country code when the input already has a +', () => {
      // Even if defaultCountryCode is IN, a +14155552671 stays US.
      expect(normalizePhone('+14155552671', 'IN')).toBe('+14155552671');
    });

    it('only applies the prefix when the local digit count matches', () => {
      // 9 digits is not a valid IN local number — fall back to raw.
      expect(normalizePhone('987654321', 'IN')).toBe('+987654321');
    });

    it('handles US default (10 digits)', () => {
      expect(normalizePhone('4155552671', 'US')).toBe('+14155552671');
    });

    it('handles AE default (9 digits)', () => {
      expect(normalizePhone('501234567', 'AE')).toBe('+971501234567');
    });

    it('without defaultCountryCode, a bare local number stays bare', () => {
      // Preserves the original normalizer's behaviour for callers that
      // don't want country inference (e.g. the sign-up screen, which
      // forces +91 via the country pill anyway).
      expect(normalizePhone('9876543210')).toBe('+9876543210');
    });
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
