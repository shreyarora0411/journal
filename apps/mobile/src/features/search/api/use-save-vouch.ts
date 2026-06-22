import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * The set of vouch ids the current user has saved into ANY of their lists,
 * so search cards can render a filled "saved" state. (A "plan" is just a
 * list filled with saved vouches — v3.1 §6 collapsed Plan into List.)
 */
export const useSavedVouchIds = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['saved-vouch-ids', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Set<string>> => {
      if (!userId) return new Set();
      const supabase = getSupabase();
      // Items this user added (added_by_user_id = me) — i.e. vouches they
      // saved into their own lists, including others' vouches.
      const { data, error } = await supabase
        .from('vouch_list_items')
        .select('vouch_id')
        .eq('added_by_user_id', userId);
      if (error) {
        if ((error as { code?: string }).code === '42P01') return new Set();
        throw error;
      }
      return new Set((data ?? []).map((r) => (r as { vouch_id: string }).vouch_id));
    },
  });
};

type SaveVars = { vouchId: string; destinationText: string };

/**
 * Save someone's vouch into the user's list for that destination. Finds-or-
 * creates the destination list (a vouch saved while planning lands in your
 * own list — which can mix your picks and saved ones, §6), then links via
 * vouch_list_items.
 */
export const useSaveVouch = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async ({ vouchId, destinationText }: SaveVars): Promise<{ saved: true }> => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();

      // Find-or-create the user's list for this destination.
      const { data: existing, error: findErr } = await supabase
        .from('lists')
        .select('id')
        .eq('owner_id', userId)
        .eq('title', destinationText)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;

      let listId = (existing as { id: string } | null)?.id ?? null;
      if (!listId) {
        const { data: created, error: createErr } = await supabase
          .from('lists')
          .insert({ owner_id: userId, title: destinationText, destination_text: destinationText })
          .select('id')
          .single();
        if (createErr) throw createErr;
        listId = (created as { id: string }).id;
      }

      const { error: linkErr } = await supabase
        .from('vouch_list_items')
        .upsert(
          { vouch_id: vouchId, list_id: listId, added_by_user_id: userId },
          { onConflict: 'vouch_id,list_id', ignoreDuplicates: true },
        );
      if (linkErr) throw linkErr;

      log.event('vouch.saved');
      return { saved: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-vouch-ids', userId] });
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });
};
