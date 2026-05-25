import type { Verdict } from '@/components';
import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type VerdictTarget = 'trip' | 'city' | 'venue';

type Vars = {
  target_type: VerdictTarget;
  target_id: string;
  verdict: Verdict;
};

/**
 * Upserts a love/mid/skip verdict on a trip/city/venue (migration 13,
 * renamed in the geographic-hierarchy refactor).
 * One verdict per (user, target_type, target_id) — re-picking updates,
 * doesn't insert. The verdicts.user_id is auth.uid(); the upsert relies
 * on the unique index verdicts_user_target_uq.
 *
 * On success, invalidates any feed query that may have stale love
 * counts so the trip card re-renders with the bumped number.
 */
export const useSetVerdict = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (vars: Vars) => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();
      const { error } = await supabase.from('verdicts').upsert(
        {
          user_id: userId,
          target_type: vars.target_type,
          target_id: vars.target_id,
          verdict: vars.verdict,
        },
        { onConflict: 'user_id,target_type,target_id' },
      );
      if (error) throw error;
      log.event('verdict.set', {
        target_type: vars.target_type,
        verdict: vars.verdict,
      });
    },
    onSuccess: () => {
      // Trip cards on the feed read love_count via the
      // trip_with_verdict_counts view. Re-invalidate so the new count
      // pulls through.
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
