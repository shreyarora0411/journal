import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { type VouchComposer, VouchComposerSchema } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type Result = { vouchId: string; listId: string | null };

/**
 * Vouched v3.1 save: create one standalone vouch, optionally dropping it into
 * a list.
 *
 * List resolution:
 *   - explicit list_id   → link to it (the curate door — "+ Add a vouch")
 *   - new_list_name      → find-or-create a list with that name, then link
 *   - neither            → STANDALONE. No list link, no auto-minted destination
 *                          list. The vouch still surfaces in search, the circle
 *                          feed, and the author's profile (the fast door).
 *
 * No trip, no verdict. The vouch is the atom; list membership is optional and
 * lives in vouch_list_items (a vouch can be added to more lists later).
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

      // 2. Resolve a target list ONLY when one is requested. A vouch with no
      //    list_id and no new_list_name stays standalone — we no longer mint a
      //    junk one-item destination list for every fast log.
      let listId = parsed.list_id ?? null;
      if (!listId && parsed.new_list_name?.trim()) {
        const wantedTitle = parsed.new_list_name.trim();
        // Case-insensitive find-or-create so "Goa"/"goa" resolve to one list.
        const { data: existing, error: findErr } = await supabase
          .from('lists')
          .select('id')
          .eq('owner_id', userId)
          .ilike('title', wantedTitle)
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

      // 3. Link vouch → list, only when there is one.
      if (listId) {
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
      }

      log.event('vouch.created', { vouch_type: parsed.vouch_type, standalone: listId == null });
      return { vouchId, listId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouches'] });
      qc.invalidateQueries({ queryKey: ['lists'] });
      qc.invalidateQueries({ queryKey: ['profile', 'lists', userId] });
    },
  });
};
