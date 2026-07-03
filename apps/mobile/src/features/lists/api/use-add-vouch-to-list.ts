import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Add an EXISTING vouch (one the user already wrote) to a list — the curation
 * gesture, distinct from writing a brand-new vouch into the list via the
 * composer. Writes the M2M row in vouch_list_items; idempotent via the
 * (vouch_id, list_id) unique index, so re-adding is a no-op. Same write the
 * composer's create-vouch performs for its link step, so RLS (vli_owner_write)
 * already permits it for the list owner.
 */
export const useAddVouchToList = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async ({ vouchId, listId }: { vouchId: string; listId: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await getSupabase()
        .from('vouch_list_items')
        .upsert(
          { vouch_id: vouchId, list_id: listId, added_by_user_id: userId },
          { onConflict: 'vouch_id,list_id', ignoreDuplicates: true },
        );
      if (error) throw error;
      return { vouchId, listId };
    },
    onSuccess: (_d, vars) => {
      // Refetch the list's vouches (so the added one appears + drops out of the
      // picker) and the lists overview.
      qc.invalidateQueries({ queryKey: ['lists', 'vouches', vars.listId] });
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });
};
