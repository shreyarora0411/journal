import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export type MapDestination = {
  name: string;
  country: string | null;
  status: 'visited' | 'wishlist';
  trip_count: number;
  /** From whose recommendation came the wishlist save. */
  saved_from?: string | null;
};

export const useMapData = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['map-data', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MapDestination[]> => {
      if (!userId) return [];
      const supabase = getSupabase();

      // Visited: distinct (country, place name) across the user's own trips.
      // For pilot, just group by place country if present, else use the trip
      // title as the destination label.
      const { data: trips } = await supabase
        .from('trips')
        .select('id, title, places(country, name)')
        .eq('user_id', userId)
        .is('deleted_at', null);

      const visited = new Map<string, MapDestination>();
      type T = {
        id: string;
        title: string;
        places: { country: string | null; name: string }[] | null;
      };
      for (const t of (trips ?? []) as unknown as T[]) {
        const places = t.places ?? [];
        if (places.length === 0) {
          const key = t.title.toLowerCase();
          visited.set(key, {
            name: t.title,
            country: null,
            status: 'visited',
            trip_count: (visited.get(key)?.trip_count ?? 0) + 1,
          });
          continue;
        }
        for (const p of places) {
          const key = `${p.name.toLowerCase()}|${(p.country ?? '').toLowerCase()}`;
          visited.set(key, {
            name: p.name,
            country: p.country,
            status: 'visited',
            trip_count: (visited.get(key)?.trip_count ?? 0) + 1,
          });
        }
      }

      // Wishlist: destinations or places saved.
      const { data: wishlist, error: wishErr } = await supabase
        .from('wishlist_items')
        .select(
          'destination:destination_id(name, country), place:place_id(name, country), saved_from:saved_from_user_id(display_name, handle)',
        )
        .eq('user_id', userId);

      const wishItems: MapDestination[] = [];
      if (!wishErr) {
        type W = {
          destination: { name: string; country: string | null } | null;
          place: { name: string; country: string | null } | null;
          saved_from: { display_name: string | null; handle: string | null } | null;
        };
        for (const w of (wishlist ?? []) as unknown as W[]) {
          const d = w.destination ?? w.place;
          if (!d) continue;
          wishItems.push({
            name: d.name,
            country: d.country,
            status: 'wishlist',
            trip_count: 0,
            saved_from: w.saved_from?.display_name ?? w.saved_from?.handle ?? null,
          });
        }
      }

      return [...visited.values(), ...wishItems];
    },
  });
};
