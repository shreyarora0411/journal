import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Soft-delete an atomic log (venue row). Sets deleted_at = now() so
 * the row disappears from My tips, Feed, and search on next refetch.
 *
 * RLS: venues_owner_delete (migration 31) — auth.uid() = user_id.
 * We send UPDATE rather than DELETE to keep the soft-delete contract
 * (CLAUDE.md §5).
 */
export const useDeleteAtomicLog = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (venueId: string): Promise<void> => {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('venues')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', venueId);
      if (error) throw error;
      log.event('atomic_log.deleted');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atomic-logs'] });
      qc.invalidateQueries({ queryKey: ['feed', userId] });
      qc.invalidateQueries({ queryKey: ['me-stats'] });
    },
  });
};
