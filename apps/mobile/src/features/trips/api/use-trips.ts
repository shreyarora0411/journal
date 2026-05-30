import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import type { Trip } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';
import { tripKeys } from './keys';

/** A trip plus its embedded cities — used by auto-suggest in the tip
 *  log to match a picked place against a trip's seed cities. The base
 *  `Trip` type is unchanged; this widens it for callers that need the
 *  city array. */
export type TripWithCities = Trip & {
  cities: { id: string; name: string }[] | null;
};

/**
 * Lists the current user's own trips, newest first.
 * Phase 3 will add a separate hook for friends' trips (the feed).
 */
export const useMyTrips = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: tripKeys.list(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<TripWithCities[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('trips')
        // Embed cities so callers (auto-suggest on tip log) can match a
        // picked place against a trip's seed city without a second
        // round-trip per trip.
        .select('*, cities(id, name)')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TripWithCities[];
    },
  });
};
