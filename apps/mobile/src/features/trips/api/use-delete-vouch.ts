import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Soft-delete a vouch (owner-only). Sets deleted_at; the list/feed/search
 * surfaces all filter deleted_at, so it vanishes everywhere (CLAUDE.md §5 —
 * soft delete only). The vouch_list_items links can stay; the list query
 * filters the deleted vouch out.
 */
export const useDeleteVouch = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async ({ vouchId }: { vouchId: string }): Promise<void> => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();
      const { error } = await supabase
        .from('vouches')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', vouchId)
        .eq('user_id', userId);
      if (error) throw error;
      log.event('vouch.deleted');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists'] });
      qc.invalidateQueries({ queryKey: ['vouches'] });
      qc.invalidateQueries({ queryKey: ['saved-vouch-ids', userId] });
    },
  });
};
