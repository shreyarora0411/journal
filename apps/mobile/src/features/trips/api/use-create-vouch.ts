import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { type VouchComposer, VouchComposerSchema } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type Result = { vouchId: string; listId: string };

/**
 * Vouched v3.1 save: create one standalone vouch and drop it into a list.
 *
 * List resolution (composer step 5):
 *   - explicit list_id   → use it
 *   - new_list_name      → create a list with that name (place-anchored to
 *                          the destination)
 *   - neither (default)  → find-or-create the destination list, so the
 *                          common case is one tap
 *
 * No trip, no verdict. The vouch stands alone; membership lives in
 * vouch_list_items (a vouch can later be added to more lists).
 */
export const useCreateVouch = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (input: VouchComposer): Promise<Result> => {
      if (!userId) throw new Error('Not signed in');
      const parsed = VouchComposerSchema.parse(input);
      const supabase = getSupabase();
      const visibility = parsed.visibility;

      // 1. The standalone vouch.
      const { data: vouch, error: vouchErr } = await supabase
        .from('vouches')
        .insert({
          user_id: userId,
          text: parsed.text,
          vouch_type: parsed.vouch_type,
          destination_text: parsed.destination_text,
          source: 'user_created',
          visibility,
        })
        .select('id')
        .single();
      if (vouchErr) throw vouchErr;
      const vouchId = (vouch as { id: string }).id;

      // 2. Resolve the target list.
      let listId = parsed.list_id ?? null;
      if (!listId) {
        const wantedTitle = parsed.new_list_name?.trim() || parsed.destination_text;
        // Find an existing list with this title owned by the user (the
        // destination list, if it was auto-created on a previous vouch).
        const { data: existing, error: findErr } = await supabase
          .from('lists')
          .select('id')
          .eq('owner_id', userId)
          .eq('title', wantedTitle)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();
        if (findErr) throw findErr;
        listId = (existing as { id: string } | null)?.id ?? null;
        if (!listId) {
          const { data: created, error: createErr } = await supabase
            .from('lists')
            .insert({
              owner_id: userId,
              title: wantedTitle,
              destination_text: parsed.destination_text,
              visibility,
            })
            .select('id')
            .single();
          if (createErr) {
            // Vouch saved but list creation failed — roll back the orphan.
            await supabase.from('vouches').delete().eq('id', vouchId);
            throw createErr;
          }
          listId = (created as { id: string }).id;
        }
      }

      // 3. Link vouch → list.
      const { error: linkErr } = await supabase
        .from('vouch_list_items')
        .upsert(
          { vouch_id: vouchId, list_id: listId, added_by_user_id: userId },
          { onConflict: 'vouch_id,list_id', ignoreDuplicates: true },
        );
      if (linkErr) {
        log.error('vouch_list_items link failed after vouch create', linkErr);
        await supabase.from('vouches').delete().eq('id', vouchId);
        throw linkErr;
      }

      log.event('vouch.created', { vouch_type: parsed.vouch_type });
      return { vouchId, listId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouches'] });
      qc.invalidateQueries({ queryKey: ['lists'] });
      qc.invalidateQueries({ queryKey: ['profile', 'lists', userId] });
    },
  });
};
