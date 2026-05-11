import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type WishlistRow = {
  id: string;
  user_id: string;
  place_id: string | null;
  destination_id: string | null;
  saved_from_trip_id: string | null;
  saved_from_user_id: string | null;
  note: string | null;
  created_at: string;
  // Joined display:
  destination_name?: string | null;
  destination_country?: string | null;
  place_name?: string | null;
};

const wishlistKey = (userId: string | null) => ['wishlist', userId] as const;

export const useWishlist = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: wishlistKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<WishlistRow[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('wishlist_items')
        .select(
          'id, user_id, place_id, destination_id, saved_from_trip_id, saved_from_user_id, note, created_at, destination:destination_id(name, country), place:place_id(name)',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      type Raw = WishlistRow & {
        destination: { name: string; country: string | null } | null;
        place: { name: string } | null;
      };
      return ((data ?? []) as unknown as Raw[]).map((r) => ({
        ...r,
        destination_name: r.destination?.name ?? null,
        destination_country: r.destination?.country ?? null,
        place_name: r.place?.name ?? null,
      }));
    },
  });
};

type SaveVars = {
  place_id?: string | null;
  destination_id?: string | null;
  saved_from_trip_id?: string | null;
  saved_from_user_id?: string | null;
  note?: string | null;
};

export const useSaveToWishlist = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async (vars: SaveVars) => {
      if (!userId) throw new Error('Not signed in');
      if (!vars.place_id && !vars.destination_id) throw new Error('Need a place or destination');
      const supabase = getSupabase();
      const { error } = await supabase.from('wishlist_items').insert({
        user_id: userId,
        place_id: vars.place_id ?? null,
        destination_id: vars.destination_id ?? null,
        saved_from_trip_id: vars.saved_from_trip_id ?? null,
        saved_from_user_id: vars.saved_from_user_id ?? null,
        note: vars.note ?? null,
      });
      if (error) throw error;
      log.event('wishlist.saved');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wishlistKey(userId) });
    },
  });
};
