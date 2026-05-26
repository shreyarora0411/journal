import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import type { ListItemTarget } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { listKeys } from './keys';

export type AddPolymorphicListItemVars = {
  list_id: string;
  target_type: ListItemTarget;
  target_id: string;
  note?: string | null;
};

/**
 * Inserts into list_items using the polymorphic (target_type, target_id)
 * path from migration 30. Computes the next `position` server-side via
 * a head-only select and handles the 23505 unique-violation as a
 * caller-friendly "already in list" error.
 *
 * Kept separate from the legacy useAddListItem (destination_id / city_id)
 * so existing call-sites keep working until they migrate over.
 */
export const useAddPolymorphicListItem = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (vars: AddPolymorphicListItemVars) => {
      const supabase = getSupabase();

      const { data: existing, error: existErr } = await supabase
        .from('list_items')
        .select('position')
        .eq('list_id', vars.list_id)
        .order('position', { ascending: false })
        .limit(1);
      if (existErr) throw existErr;
      const nextPosition = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;

      const { error } = await supabase.from('list_items').insert({
        list_id: vars.list_id,
        target_type: vars.target_type,
        target_id: vars.target_id,
        note: vars.note ?? null,
        position: nextPosition,
        order_index: nextPosition,
        added_by_user_id: userId,
      });
      if (error) {
        if (error.code === '23505') throw new Error('Already in this list');
        throw error;
      }
      log.event('list.item_added', { target_type: vars.target_type });
      return { listId: vars.list_id };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: listKeys.items(result.listId) });
      qc.invalidateQueries({ queryKey: listKeys.mine(userId) });
      qc.invalidateQueries({ queryKey: listKeys.all });
    },
  });
};

/**
 * Inverse — remove a polymorphic item from a list. Returns silently if
 * the row doesn't exist (idempotent toggle behavior for the picker
 * sheet's check-then-uncheck flow).
 */
export const useRemovePolymorphicListItem = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (vars: AddPolymorphicListItemVars) => {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('list_id', vars.list_id)
        .eq('target_type', vars.target_type)
        .eq('target_id', vars.target_id);
      if (error) throw error;
      log.event('list.item_removed', { target_type: vars.target_type });
      return { listId: vars.list_id };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: listKeys.items(result.listId) });
      qc.invalidateQueries({ queryKey: listKeys.mine(userId) });
      qc.invalidateQueries({ queryKey: listKeys.all });
    },
  });
};
