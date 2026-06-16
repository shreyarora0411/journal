import { formatVouchDate } from './format-vouch-date';

// All tests pin `now` so they don't drift with the wall clock.
const NOW = new Date('2026-06-10T12:00:00Z');

describe('formatVouchDate', () => {
  it('same month → "This month" + recent', () => {
    const out = formatVouchDate(new Date('2026-06-01T12:00:00Z'), NOW);
    expect(out).toEqual({ display: 'This month', freshness: 'recent' });
  });

  it('1 month ago → "1 month ago" + recent', () => {
    const out = formatVouchDate(new Date('2026-05-01T12:00:00Z'), NOW);
    expect(out).toEqual({ display: '1 month ago', freshness: 'recent' });
  });

  it('2 months ago → "2 months ago" + recent', () => {
    const out = formatVouchDate(new Date('2026-04-01T12:00:00Z'), NOW);
    expect(out).toEqual({ display: '2 months ago', freshness: 'recent' });
  });

  it('3 months ago → month-year + current', () => {
    const out = formatVouchDate(new Date('2026-03-01T12:00:00Z'), NOW);
    expect(out).toEqual({ display: 'March 2026', freshness: 'current' });
  });

  it('6 months ago → month-year + current', () => {
    const out = formatVouchDate(new Date('2025-12-01T12:00:00Z'), NOW);
    expect(out).toEqual({ display: 'December 2025', freshness: 'current' });
  });

  it('exactly 12 months ago → month-year + stale (boundary case)', () => {
    const out = formatVouchDate(new Date('2025-06-01T12:00:00Z'), NOW);
    expect(out).toEqual({ display: 'June 2025', freshness: 'stale' });
  });

  it('24 months ago → month-year + stale', () => {
    const out = formatVouchDate(new Date('2024-06-01T12:00:00Z'), NOW);
    expect(out).toEqual({ display: 'June 2024', freshness: 'stale' });
  });

  it('future date collapses to "This month" + recent (no negative months)', () => {
    const out = formatVouchDate(new Date('2026-12-01T12:00:00Z'), NOW);
    expect(out.freshness).toBe('recent');
  });
});
