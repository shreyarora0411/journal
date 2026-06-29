import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/** A behavioural interaction with someone else's vouch. 'save' = saved into a
 *  list; 'maps' = opened in Maps; 'share' = shared. The RPC turns enough of
 *  these (per author, per category) into a learned trust context. */
export type InteractionKind = 'save' | 'maps' | 'share';

type RecordVars = { vouchId: string; kind: InteractionKind };

/**
 * Record a behavioural interaction (save / Open in Maps / Share) on a vouch so
 * the backend can learn "you trust X for food / stays" from revealed
 * preference — the food-friend / stays-friend use case (migration 51). The
 * RPC no-ops on your own vouches, so callers don't have to pre-filter.
 *
 * Fire-and-forget: this rides alongside a user action (opening Maps, sharing),
 * so it must NEVER block or surface an error. Failures are swallowed and
 * logged. On success we invalidate ['vouch-search'] so a freshly-earned trust
 * context re-ranks the results immediately ("You trust X for {ctx}").
 */
export const useRecordInteraction = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ vouchId, kind }: RecordVars): Promise<void> => {
      const supabase = getSupabase();
      const { error } = await supabase.rpc('record_vouch_interaction', {
        p_vouch_id: vouchId,
        p_kind: kind,
      });
      if (error) throw error;
    },
    // Never let a learning write disrupt the user's action.
    onError: (err) => {
      log.error('record vouch interaction failed', err);
    },
    onSuccess: () => {
      // A newly-earned trust context changes ranking — re-run the search.
      qc.invalidateQueries({ queryKey: ['vouch-search'] });
    },
  });
};
