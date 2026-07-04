import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { TASTE_AXES, type TasteAxes } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Persist the onboarding either/or taps as the user's taste priors
 * (user_taste_priors, own-row RLS). Folded into the taste vector at weight 2
 * ("loved-place equivalents", spec §2②) so a brand-new user is matchable from
 * log #1. Priors are PRIVATE — they never enter the cross-user match (which is
 * loves-only by design).
 */
export const useSavePriors = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    // Pure upsert — safe to retry past iOS dead-socket failures (see
    // use-log-place.ts for the pattern).
    retry: 2,
    retryDelay: 400,
    mutationFn: async (axes: Partial<TasteAxes>): Promise<void> => {
      if (!userId) throw new Error('Not signed in');
      const arr = TASTE_AXES.map((a) => axes[a] ?? 0);
      const { error } = await getSupabase()
        .from('user_taste_priors')
        .upsert({ user_id: userId, axes: arr }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taste'] }),
  });
};
