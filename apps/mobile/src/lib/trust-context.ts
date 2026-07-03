import type { VouchType } from '@journal/shared';

/**
 * Trust contexts — the visible face of `trust_contexts` (CLAUDE.md §0): WHAT a
 * person is trusted FOR, by domain. There is no taste-similarity engine by
 * design; "taste" is these behaviourally-grounded domain contexts (a vouch
 * typed into a category slot IS a domain signal).
 *
 * The design routes this ONE signal to three surfaces — the profile "what
 * you're known for" line, the friend-view trust line, and the Friends
 * directory rows — so the phrasing and derivation live here once. Mirrors the
 * vouch_type→context map that search's `vouchReason()` inlines.
 */

// Labels are tuned to read inside a sentence: "you trust Rhea for {label}",
// "trusted for {label}". 'skip' is a negative signal — never something you're
// trusted FOR — so it's excluded from derivation below; it stays in the map for
// display completeness only.
const CONTEXT_LABEL: Record<VouchType, string> = {
  stay: 'stays',
  eat_drink: 'food',
  do: 'things to do',
  nightlife: 'nightlife',
  good_to_know: 'local know-how',
  skip: 'what to skip',
};

export const trustContextLabel = (t: VouchType): string => CONTEXT_LABEL[t] ?? 'local know-how';

/** A person's derived trust shape, tallied from the vouches they authored. */
export type TrustProfile = {
  /** Dominant 1–2 domain labels, most-vouched first. */
  contexts: string[];
  /** Total non-deleted vouches counted (includes 'skip'). */
  vouchCount: number;
  /** Most-frequent destination, for the "in {place}" tail. */
  topDestination: string | null;
  /** Distinct destinations vouched for. */
  destinationCount: number;
};

const MAX_CONTEXTS = 2;

/**
 * Derive what a person is trusted for from their vouches. Returns null when
 * there's nothing to say (zero vouches) so callers can suppress the line.
 * 'skip' vouches count toward the total but never toward the contexts — you
 * aren't "known for" what to avoid.
 */
export function deriveTrustProfile(
  vouches: ReadonlyArray<{ vouch_type: VouchType; destination_text: string | null }>,
): TrustProfile | null {
  if (vouches.length === 0) return null;

  const typeTally = new Map<VouchType, number>();
  const destTally = new Map<string, number>();
  for (const v of vouches) {
    if (v.vouch_type !== 'skip') {
      typeTally.set(v.vouch_type, (typeTally.get(v.vouch_type) ?? 0) + 1);
    }
    const dest = v.destination_text?.trim();
    if (dest) destTally.set(dest, (destTally.get(dest) ?? 0) + 1);
  }

  // Most-vouched domains first; ties keep insertion order (Map preserves it).
  const contexts = [...typeTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CONTEXTS)
    .map(([t]) => trustContextLabel(t));

  let topDestination: string | null = null;
  let topCount = 0;
  for (const [dest, count] of destTally) {
    if (count > topCount) {
      topDestination = dest;
      topCount = count;
    }
  }

  return {
    contexts,
    vouchCount: vouches.length,
    topDestination,
    destinationCount: destTally.size,
  };
}

/** "stays" · "stays & food" — joins the 1–2 dominant contexts for a sentence. */
export function joinContexts(contexts: string[]): string {
  const [first, second] = contexts;
  if (!first) return 'local know-how';
  if (!second) return first;
  return `${first} & ${second}`;
}

/**
 * The profile "what you're known for" line — "stays & food in Goa" or, when a
 * person vouches across places, "stays & food · 4 places". Returns null when
 * the trust profile is empty (callers suppress the whole line). The leading
 * verb ("Known for") lives in the surface, not here, so the friend-view can
 * reuse the same tail with "You trust {name} for …".
 */
export function knownForTail(p: TrustProfile): string {
  const ctx = joinContexts(p.contexts);
  if (p.destinationCount === 1 && p.topDestination) return `${ctx} in ${p.topDestination}`;
  if (p.destinationCount > 1) {
    return `${ctx} · ${p.destinationCount} places`;
  }
  return ctx;
}
