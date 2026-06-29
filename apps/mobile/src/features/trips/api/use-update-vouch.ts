import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Edit a vouch's voiced text (owner-only — the eq('user_id') + RLS both
 * enforce it). Lets a logger fix a typo instead of every Save being permanent.
 */
export const useUpdateVouch = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async ({ vouchId, text }: { vouchId: string; text: string }): Promise<void> => {
      if (!userId) throw new Error('Not signed in');
      const trimmed = text.trim();
      if (trimmed.length === 0) throw new Error('A vouch needs some words.');
      const supabase = getSupabase();
      const { error } = await supabase
        .from('vouches')
        .update({ text: trimmed.slice(0, 500) })
        .eq('id', vouchId)
        .eq('user_id', userId);
      if (error) throw error;
      log.event('vouch.updated');
    },
    onSuccess: () => {
      // ['lists'] is a prefix of the list-vouches key, so this refreshes the
      // open list; ['vouches'] covers the feed.
      qc.invalidateQueries({ queryKey: ['lists'] });
      qc.invalidateQueries({ queryKey: ['vouches'] });
    },
  });
};
