import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import type { VouchType } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';

/** One of the current user's own vouches, newest first. The owner-visibility
 *  pool for the profile "Your vouches" section — standalone (listless) vouches
 *  surface here so fast-door logging isn't a void. Mirrors the read in
 *  features/ask/api/use-ask.ts (useMyVouches). */
export type MyVouchRow = {
  id: string;
  text: string;
  vouch_type: VouchType;
  destination_text: string;
  created_at: string;
};

/** The current user's own vouches, newest first — every vouch they authored,
 *  list-bound or standalone. Drives the profile's "Your vouches" section. */
export const useMyVouches = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['vouches', 'mine', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MyVouchRow[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('vouches')
        .select('id, text, vouch_type, destination_text, created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) {
        // Table-not-found (fresh local DB) is non-fatal — show an empty section.
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as unknown as MyVouchRow[];
    },
  });
};
