import { useAuthStore } from '@/features/auth';
import { recordPlaceSignal } from '@/lib/signals';
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
      // place_interactions needs the vouch's canonical place (nullable, not in
      // the vars) — resolve it out-of-band so the lookup can never delay or
      // fail the add; fire-and-forget like the signal itself.
      void (async () => {
        const { data } = await getSupabase()
          .from('vouches')
          .select('place_id')
          .eq('id', vouchId)
          .maybeSingle();
        const placeId = (data as { place_id: string | null } | null)?.place_id;
        if (placeId) recordPlaceSignal('list_add', placeId);
      })().catch(() => undefined);
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
