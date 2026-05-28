import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { listKeys } from './keys';

/**
 * Soft-delete a list. Sets deleted_at = now() on public.lists. Existing
 * read hooks already filter on deleted_at is null, so the list
 * disappears from My Lists + the picker on next refetch.
 *
 * RLS — the lists_owner_all policy from migration 5 covers UPDATE for
 * owner_id = auth.uid().
 */
export const useDeleteList = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (listId: string): Promise<void> => {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('lists')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', listId);
      if (error) throw error;
      log.event('list.deleted');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listKeys.mine(userId) });
      qc.invalidateQueries({ queryKey: listKeys.all });
    },
  });
};
