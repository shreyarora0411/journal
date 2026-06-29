import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import type { VouchType } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';

/**
 * One save of the viewer's own vouch by SOMEONE ELSE in their circle — the
 * altruistic payoff signal (Hennig-Thurau concern-for-others). No counts, no
 * score: just who saved what you said. Backed by get_vouch_uses() (migration
 * 50), which only ever returns saves of vouches the caller authored.
 */
export type VouchUse = {
  vouch_id: string;
  vouch_text: string;
  vouch_type: VouchType;
  destination_text: string;
  saver_id: string;
  saver_name: string | null;
  saver_handle: string | null;
  saver_avatar: string | null;
  saved_at: string;
};

// Function-not-deployed (pre-migration-50 DB): PostgREST 404 / Postgres
// undefined_function. Tolerate both so a stale local DB shows an empty section
// instead of a thrown query.
const FUNCTION_MISSING = new Set(['PGRST202', '42883']);

/**
 * "Used by your circle" — the saves OTHERS made of the viewer's own vouches,
 * newest first. PULL-based (no push, CLAUDE.md §9/§12): the author sees it when
 * they open their profile. Returns [] when the RPC isn't deployed yet.
 */
export const useVouchUses = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['vouches', 'uses', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<VouchUse[]> => {
      if (!userId) return [];
      const { data, error } = await getSupabase().rpc('get_vouch_uses');
      if (error) {
        if (FUNCTION_MISSING.has(error.code ?? '')) return [];
        throw error;
      }
      return (data ?? []) as unknown as VouchUse[];
    },
  });
};
