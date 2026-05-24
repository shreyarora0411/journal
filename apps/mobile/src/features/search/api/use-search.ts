import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export type SearchKind = 'place' | 'venue' | 'area' | 'tip';

export type SearchResult = {
  kind: SearchKind;
  id: string;
  trip_id: string;
  trip_title: string;
  trip_user_id: string;
  name: string;
  quote: string | null;
  rank: number;
  created_at: string;
};

const DEBOUNCE_MS = 300;

/** Debounces `value` by the given delay. */
export const useDebounced = <T>(value: T, delayMs = DEBOUNCE_MS): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
};

/**
 * Full-text search across visible friend-graph entities.
 * Returns empty array for empty / whitespace queries (no debounce wait needed).
 */
export const useSearch = (rawQuery: string) => {
  const debounced = useDebounced(rawQuery.trim());
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: ['search', viewerId, debounced],
    enabled: Boolean(viewerId) && debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<SearchResult[]> => {
      if (!viewerId || debounced.length < 2) return [];
      const supabase = getSupabase();
      // Migration 11 dropped the `viewer` parameter; the function reads
      // `auth.uid()` internally so a malicious caller can't pass someone
      // else's id and read their search results.
      const { data, error } = await supabase.rpc('search_friend_graph', {
        q: debounced,
      });
      if (error) throw error;
      return (data ?? []) as SearchResult[];
    },
  });
};
