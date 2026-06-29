import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import type { VouchType } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';

/** A vouch inside a list (via vouch_list_items), with its author. `user_id`
 *  is the author's id, so a screen can gate edit/delete to the viewer's own
 *  vouches. */
export type ListVouch = {
  id: string;
  text: string;
  vouch_type: VouchType;
  destination_text: string;
  created_at: string;
  user_id: string;
  author: { display_name: string | null; handle: string | null; avatar_url: string | null } | null;
};

/**
 * The vouches in a list (v3.1). Reads vouch_list_items → vouches; RLS on both
 * tables bounds visibility (you see the list's vouches if you can see the
 * list and each vouch). A list can mix the owner's vouches and ones they
 * saved from others (§6) — both come back here.
 */
export const useListVouches = (listId: string | null | undefined) => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['lists', 'vouches', listId],
    enabled: Boolean(userId) && Boolean(listId),
    queryFn: async (): Promise<ListVouch[]> => {
      if (!listId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('vouch_list_items')
        .select(
          'added_at, vouch:vouch_id(id, text, vouch_type, destination_text, created_at, ' +
            'user_id, deleted_at, author:user_id(display_name, handle, avatar_url))',
        )
        .eq('list_id', listId)
        .order('added_at', { ascending: true });
      if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
      }
      type Row = { vouch: (ListVouch & { deleted_at: string | null }) | null };
      return (
        ((data ?? []) as unknown as Row[])
          .map((r) => r.vouch)
          // Hide soft-deleted vouches — the list query doesn't filter them at the
          // join, so drop them here.
          .filter(
            (v): v is ListVouch & { deleted_at: string | null } =>
              v != null && v.deleted_at == null,
          )
      );
    },
  });
};
