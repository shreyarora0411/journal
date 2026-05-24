import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * Aggregate counts surfaced on the Profile screen (trips, distinct
 * countries logged, tips authored). Backed by the `me_stats()` RPC
 * (migration 12). Falls back to nulls (which the UI renders as `—`)
 * while the function is missing on a pre-migration DB or while loading.
 */
export type MeStats = {
  trips_count: number;
  countries_count: number;
  tips_given_count: number;
};

const FUNCTION_MISSING = new Set(['PGRST202', '42883']);

export const useMeStats = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['me-stats', userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<MeStats | null> => {
      const { data, error } = await getSupabase().rpc('me_stats').single();
      if (error) {
        // Pre-migration: function doesn't exist. Surface `null` so the
        // screen renders `—` instead of zeros.
        if (FUNCTION_MISSING.has(error.code ?? '')) return null;
        throw error;
      }
      return data as MeStats;
    },
  });
};
