import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import {
  type Sentiment,
  TASTE_AXES,
  type TasteAxes,
  ZERO_AXES,
  tasteReadout,
} from '@journal/shared';
import { useQuery } from '@tanstack/react-query';

// Missing table/function (pre-deploy DB): show empty states, never crash.
const MISSING = new Set(['42P01', '42883', 'PGRST202']);
const isMissing = (e: { code?: string } | null) => MISSING.has(e?.code ?? '');

const axesFromArray = (arr: number[] | null): TasteAxes => {
  if (!arr || arr.length !== 5) return { ...ZERO_AXES };
  const out = { ...ZERO_AXES };
  TASTE_AXES.forEach((axis, i) => {
    out[axis] = arr[i] ?? 0;
  });
  return out;
};

/** The viewer's own taste vector + readable lines ("substance-first · …"). */
export const useMyTaste = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['taste', 'mine', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<{ axes: TasteAxes; readout: string[] }> => {
      const { data, error } = await getSupabase().rpc('my_taste_axes');
      if (error) {
        if (isMissing(error)) return { axes: { ...ZERO_AXES }, readout: [] };
        throw error;
      }
      const axes = axesFromArray(data as number[] | null);
      return { axes, readout: tasteReadout(axes) };
    },
  });
};

export type MyPlaceRow = {
  sentiment: Sentiment;
  updated_at: string;
  place: {
    id: string;
    name: string;
    hub: string | null;
    zone: string | null;
    category: string | null;
    google_place_id: string;
  } | null;
};

/** Every place the viewer has reacted to, newest first (own-row RLS). */
export const useMyPlaces = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['taste', 'my-places', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MyPlaceRow[]> => {
      if (!userId) return [];
      const { data, error } = await getSupabase()
        .from('place_reactions')
        .select(
          'sentiment, updated_at, place:place_id(id, name, hub, zone, category, google_place_id)',
        )
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) {
        if (isMissing(error)) return [];
        throw error;
      }
      return (data ?? []) as unknown as MyPlaceRow[];
    },
  });
};

export type RecommendedPlace = {
  place_id: string;
  name: string;
  hub: string | null;
  zone: string | null;
  google_place_id: string;
  lat: number | null;
  lng: number | null;
  score: number;
  tier: 'taste' | 'follows' | 'tribe';
  top_lovers: {
    user_id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
    match: number | null;
    followed: boolean;
    note: string | null;
  }[];
};

/** The Go-out query: {zone, hub, occasion} → taste-ranked places, tier-labeled. */
export const useRecommendPlaces = (
  zone: string | null,
  hub: string | null,
  occasion: string | null,
) => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['taste', 'recommend', userId, zone, hub, occasion],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<RecommendedPlace[]> => {
      const { data, error } = await getSupabase().rpc('recommend_places', {
        p_zone: zone,
        p_hub: hub,
        p_occasion: occasion,
        p_limit: 30,
      });
      if (error) {
        if (isMissing(error)) return [];
        throw error;
      }
      return (data ?? []) as RecommendedPlace[];
    },
  });
};

export type TasteTwin = {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  match: number;
  followed: boolean;
  love_count: number;
};

/** People whose taste provably matches the viewer's. Empty until both sides
 *  pass the 8-love confidence gate — the screen shows the honest prompt. */
export const useTasteTwins = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['taste', 'twins', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<TasteTwin[]> => {
      const { data, error } = await getSupabase().rpc('taste_twins', { p_limit: 20 });
      if (error) {
        if (isMissing(error)) return [];
        throw error;
      }
      return (data ?? []) as TasteTwin[];
    },
  });
};

export type PlaceLover = {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  match: number | null;
  followed: boolean;
  note: string | null;
};

/** A place + who in the graph loved it (attributed, visibility-gated notes). */
export const usePlaceDetail = (placeId: string | null) => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['taste', 'place', placeId],
    enabled: Boolean(userId) && Boolean(placeId),
    queryFn: async () => {
      const supabase = getSupabase();
      const [placeRes, loversRes] = await Promise.all([
        supabase
          .from('canonical_places')
          .select('id, name, hub, zone, category, google_place_id, lat, lng, destination_text')
          .eq('id', placeId as string)
          .maybeSingle(),
        supabase.rpc('place_lovers', { p_place: placeId }),
      ]);
      if (placeRes.error && !isMissing(placeRes.error)) throw placeRes.error;
      if (loversRes.error && !isMissing(loversRes.error)) throw loversRes.error;
      return {
        place: placeRes.data ?? null,
        lovers: ((loversRes.data ?? []) as PlaceLover[]) ?? [],
      };
    },
  });
};
