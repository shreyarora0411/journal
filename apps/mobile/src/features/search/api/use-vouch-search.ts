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

/** Human-readable ranking reason (v3 §7 — never a score). */
export const vouchReason = (r: VouchSearchResult): string => {
  if (r.is_own) return 'Your vouch';
  const who = r.author_name ?? r.author_handle ?? 'Someone';
  if (r.context_match) {
    const ctx =
      r.vouch_type === 'stay' ? 'stays' : r.vouch_type === 'eat_drink' ? 'food' : 'local know-how';
    return `You trust ${who} for ${ctx}`;
  }
  if (r.list_title) return `${who} vouched in ${r.list_title}`;
  return `${who} vouched for this`;
};
