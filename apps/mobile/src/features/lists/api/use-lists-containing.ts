import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import type { ListItemTarget } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';
import { listKeys } from './keys';

/**
 * Lists owned by the caller that already contain (target_type, target_id).
 * Powers the picker sheet's check-mark state and the "Saved to N lists"
 * button label on detail screens.
 *
 * Server-side: SELECT list_id FROM list_items WHERE target_type=X AND
 * target_id=Y JOIN lists WHERE owner_id=auth.uid(). RLS already prevents
 * a caller from seeing items in lists they don't own (lists_owner_all),
 * so the join filter is belt-and-braces.
 */
export const useListsContaining = (targetType: ListItemTarget | null, targetId: string | null) => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey:
      userId && targetType && targetId
        ? listKeys.containing(userId, targetType, targetId)
        : listKeys.containing(null, targetType ?? '_', targetId ?? '_'),
    enabled: Boolean(userId && targetType && targetId),
    queryFn: async (): Promise<string[]> => {
      if (!userId || !targetType || !targetId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('list_items')
        .select('list_id, lists!inner(owner_id)')
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('lists.owner_id', userId);
      if (error) {
        if (error.code === '42703' || error.code === '42P01') return [];
        throw error;
      }
      return ((data ?? []) as { list_id: string }[]).map((r) => r.list_id);
    },
  });
};
