import { useAuthStore } from '@/features/auth';
import { recordPlaceSignal } from '@/lib/signals';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Pilot-fixes session — toggle hooks for the +Plan (destination) and
 * Stash (venue) surfaces. Built on `wishlist_items` + the new columns
 * `parent_wishlist_item_id` / `target_external_id` / `target_label`
 * from migration 17. Coexists with the legacy `useWishlist` /
 * `useSaveToWishlist` until the rest of the app migrates.
 */

export type WishlistToggleRow = {
  id: string;
  parent_wishlist_item_id: string | null;
  target_external_id: string | null;
  target_label: string | null;
};

const wishlistToggleKey = (userId: string | null) => ['wishlist', 'toggle', userId] as const;

/** Caller's full wishlist (destinations + nested venues). */
export const useWishlistRows = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: wishlistToggleKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<WishlistToggleRow[]> => {
      if (!userId) return [];
      const { data, error } = await getSupabase()
        .from('wishlist_items')
        .select('id, parent_wishlist_item_id, target_external_id, target_label')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42703' || error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as WishlistToggleRow[];
    },
  });
};

/** Insert or remove a destination-level wishlist entry. */
export const useTogglePlan = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (vars: { externalId: string; label: string }) => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();
      const { data: existing } = await supabase
        .from('wishlist_items')
        .select('id')
        .eq('user_id', userId)
        .is('parent_wishlist_item_id', null)
        .eq('target_external_id', vars.externalId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from('wishlist_items')
          .delete()
          .eq('id', (existing as { id: string }).id);
        if (error) throw error;
        return { added: false };
      }
      const { error } = await supabase.from('wishlist_items').insert({
        user_id: userId,
        target_external_id: vars.externalId,
        target_label: vars.label,
      });
      if (error) throw error;
      return { added: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wishlistToggleKey(userId) }),
  });
};

/** Stash a venue under its parent destination row (auto-creating it). */
export const useToggleStash = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (vars: {
      parentExternalId: string;
      parentLabel: string;
      venueLabel: string;
      /** Canonical place id, when the caller resolved one — wishlist rows are
       *  label-keyed, so the place_interactions signal only fires with this. */
      placeId?: string | null;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();

      // Ensure the parent destination row exists.
      let parentId: string;
      const { data: parent } = await supabase
        .from('wishlist_items')
        .select('id')
        .eq('user_id', userId)
        .is('parent_wishlist_item_id', null)
        .eq('target_external_id', vars.parentExternalId)
        .maybeSingle();
      if (parent) {
        parentId = (parent as { id: string }).id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('wishlist_items')
          .insert({
            user_id: userId,
            target_external_id: vars.parentExternalId,
            target_label: vars.parentLabel,
          })
          .select('id')
          .single();
        if (createErr) throw createErr;
        parentId = (created as { id: string }).id;
      }

      // Toggle the venue child row.
      const { data: child } = await supabase
        .from('wishlist_items')
        .select('id')
        .eq('user_id', userId)
        .eq('parent_wishlist_item_id', parentId)
        .eq('target_label', vars.venueLabel)
        .maybeSingle();
      if (child) {
        const { error } = await supabase
          .from('wishlist_items')
          .delete()
          .eq('id', (child as { id: string }).id);
        if (error) throw error;
        return { added: false };
      }
      const { error } = await supabase.from('wishlist_items').insert({
        user_id: userId,
        parent_wishlist_item_id: parentId,
        target_label: vars.venueLabel,
      });
      if (error) throw error;
      if (vars.placeId) recordPlaceSignal('wishlist_add', vars.placeId);
      return { added: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wishlistToggleKey(userId) }),
  });
};
