import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import type { VouchType } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';
import { useDebounced } from './use-search';

/** One ranked vouch row from the search_vouches RPC (migration 42 — source
 *  list, not trip). */
export type VouchSearchResult = {
  vouch_id: string;
  list_id: string | null;
  list_title: string | null;
  vouch_text: string;
  vouch_type: VouchType;
  destination_text: string;
  author_id: string;
  author_name: string | null;
  author_handle: string | null;
  author_avatar: string | null;
  is_own: boolean;
  is_trusted: boolean;
  context_match: boolean;
  score: number;
  created_at: string;
  /** Author is a friend-of-a-friend (two accepted hops), not a direct follow.
   *  The product's weak-tie discovery supply — surfaced, but read differently
   *  from a direct friend on the card (migration 49). */
  is_fof: boolean;
  /** Resolved canonical venue (LEFT JOIN canonical_places on vch.place_id).
   *  Null until the background place-resolution links this vouch to a real
   *  Google place. When set, "Open in Maps" can drop an exact pin via
   *  query_place_id instead of the lead-phrase heuristic. */
  place_google_id: string | null;
  place_lat: number | null;
  place_lng: number | null;
  place_name: string | null;
};

/**
 * Trust-led destination search (Loop B). Calls the search_vouches RPC, which
 * ranks visible vouches by WHO said it. Returns [] for short queries.
 */
export const useVouchSearch = (rawDestination: string, context?: string) => {
  const destination = useDebounced(rawDestination.trim());
  // Debounce context too, or rapid edits to the context box thrash the query
  // (the key changed on every keystroke while only destination was debounced).
  const debouncedContext = useDebounced((context ?? '').trim());
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: ['vouch-search', viewerId, destination, debouncedContext || null],
    enabled: Boolean(viewerId) && destination.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<VouchSearchResult[]> => {
      if (!viewerId || destination.length < 2) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('search_vouches', {
        p_destination: destination,
        p_context: debouncedContext || null,
      });
      if (error) {
        // 42883 = function not deployed yet; fail soft so the screen shows
        // its empty state rather than crashing — but log it, or a missing
        // migration silently looks like "your circle has nothing".
        if ((error as { code?: string }).code === '42883') {
          log.error('search_vouches RPC not found — migration 39 not applied?', error);
          return [];
        }
        throw error;
      }
      return (data ?? []) as VouchSearchResult[];
    },
  });
};

/** Human-readable ranking reason (v3 §7 — never a score). Distinguishes a
 *  direct friend ("you trust {who}" / "{who} vouched") from a friend-of-a-
 *  friend ("{who} — a friend of a friend"), the weak-tie discovery supply.
 *  Trust beats FoF: a direct-trust author is phrased as a friend even if they
 *  also happen to appear in the FoF set. */
export const vouchReason = (r: VouchSearchResult): string => {
  if (r.is_own) return 'Your vouch';
  const who = r.author_name ?? r.author_handle ?? 'Someone';
  if (r.context_match) {
    const ctx =
      r.vouch_type === 'stay' ? 'stays' : r.vouch_type === 'eat_drink' ? 'food' : 'local know-how';
    return `You trust ${who} for ${ctx}`;
  }
  if (r.is_trusted) {
    return r.list_title ? `${who} vouched in ${r.list_title}` : `${who} vouched`;
  }
  if (r.is_fof) return `${who} — a friend of a friend`;
  if (r.list_title) return `${who} vouched in ${r.list_title}`;
  return `${who} vouched for this`;
};

/** Short tier label for the card/header badge — direct circle vs the wider
 *  friend-of-a-friend network. Returns null when there's nothing to flag
 *  (your own vouch, or a direct friend with no special cue needed). */
export const vouchTier = (r: VouchSearchResult): 'fof' | null => {
  if (r.is_own || r.is_trusted) return null;
  return r.is_fof ? 'fof' : null;
};
