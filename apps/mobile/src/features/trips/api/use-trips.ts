import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import type { Trip } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';
import { tripKeys } from './keys';

/**
 * Lists the current user's own trips, newest first.
 * Phase 3 will add a separate hook for friends' trips (the feed).
 */
export const useMyTrips = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: tripKeys.list(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Trip[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Trip[];
    },
  });
};
