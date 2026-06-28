/**
 * Recommendation freshness formatter — Round 2 (validator-thesis).
 *
 * Returns a display string + freshness flag for a vouch's timestamp.
 * The "vouched_at" timestamp is the trip's `created_at` per Round 2's
 * decision: when the post landed in the app. (We considered start_date
 * but went with created_at — easier to reason about and less likely to
 * mislead when a user backfills an old trip.)
 *
 * Freshness buckets:
 *   recent  — < 3 months ago. Surfaced prominently with no de-emphasis.
 *   current — 3-12 months ago. Normal weight; still trustworthy.
 *   stale   — > 12 months ago. Render the date label at ~70% opacity
 *             so old vouches don't read with the same authority as
 *             recent ones (but don't hide — old vouches still count).
 *
 * Display strings:
 *   < 1 month   → "This month"
 *   1-2 months  → "1 month ago" / "2 months ago"
 *   3-11 months → "Month YYYY" (e.g. "April 2026")
 *   >= 1 year   → "Month YYYY" (same format; the freshness flag is what
 *                  triggers the visual de-emphasis)
 */

export type VouchFreshness = 'recent' | 'current' | 'stale';

export type VouchDateLabel = {
  display: string;
  freshness: VouchFreshness;
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Whole-month delta from `then` to `now`, never negative (future
 *  dates collapse to 0 — should never happen with vouch timestamps,
 *  but cheaper than throwing). */
function monthsBetween(now: Date, then: Date): number {
  if (then >= now) return 0;
  const years = now.getFullYear() - then.getFullYear();
  const months = now.getMonth() - then.getMonth();
  let total = years * 12 + months;
  if (now.getDate() < then.getDate()) total -= 1;
  return Math.max(0, total);
}

/**
 * @param date     The vouch's timestamp (trip.created_at).
 * @param relativeTo  Optional "now" override — used in tests so the
 *                    output doesn't drift with the wall clock.
 */
export function formatVouchDate(date: Date, relativeTo: Date = new Date()): VouchDateLabel {
  const months = monthsBetween(relativeTo, date);
  if (months < 1) return { display: 'This month', freshness: 'recent' };
  if (months < 3)
    return { display: `${months} month${months === 1 ? '' : 's'} ago`, freshness: 'recent' };
  const monthLabel = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  if (months < 12) return { display: monthLabel, freshness: 'current' };
  return { display: monthLabel, freshness: 'stale' };
}
