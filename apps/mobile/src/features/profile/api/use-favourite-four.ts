import { useAuthStore, useProfile } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import type { Trip } from '@journal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const MAX_FAV = 4;

const favKey = (userId: string | null) => ['favourite-four', userId] as const;

/**
 * Read the up-to-four anchor trips for a user. Returns trips in the order
 * the user pinned them. Filters out missing/deleted trips silently.
 */
export const useFavouriteFour = (userId: string | null | undefined) =>
  useQuery({
    queryKey: favKey(userId ?? null),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Trip[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data: u, error: uErr } = await supabase
        .from('users')
        .select('favourite_four_trip_ids')
        .eq('id', userId)
        .maybeSingle();
      if (uErr) {
        if (uErr.code === '42703') return []; // column missing pre-migration
        throw uErr;
      }
      const ids =
        (u as { favourite_four_trip_ids: string[] } | null)?.favourite_four_trip_ids ?? [];
      if (ids.length === 0) return [];
      const { data: trips, error: tErr } = await supabase
        .from('trips')
        .select('*')
        .in('id', ids)
        .is('deleted_at', null);
      if (tErr) throw tErr;
      const map = new Map((trips ?? []).map((t) => [t.id as string, t as Trip]));
      const out: Trip[] = [];
      for (const id of ids) {
        const t = map.get(id);
        if (t) out.push(t);
      }
      return out;
    },
  });

/**
 * Set the favourite-four array. Pass in the canonical ordered list.
 */
export const useSetFavouriteFour = () => {
  const qc = useQueryClient();
  const profileQ = useProfile();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async (tripIds: string[]) => {
      if (!userId) throw new Error('Not signed in');
      const trimmed = tripIds.slice(0, MAX_FAV);
      const supabase = getSupabase();
      const { error } = await supabase
        .from('users')
        .update({ favourite_four_trip_ids: trimmed })
        .eq('id', userId);
      if (error) throw error;
      log.event('favourite_four.updated', { count: trimmed });
      return trimmed;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: favKey(userId) });
      profileQ.refetch();
    },
  });
};
