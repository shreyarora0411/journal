import { getSupabase } from '@/lib/supabase';
import type { Trip } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';

/**
 * Trips authored by a specific user. RLS filters out anything the viewer
 * isn't allowed to see, so for a non-follow this returns only 'everyone'
 * trips, for a follower the 'followers' + 'everyone' set, etc.
 */
export const useUserTrips = (userId: string | null | undefined) =>
  useQuery({
    queryKey: ['profile', 'trips', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Trip[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Trip[];
    },
  });

type DerivedRow = {
  id: string;
  trip_id: string;
  trip_title: string;
  name: string;
  quote: string | null;
  kind?: string | null;
};

/** Stays this user has recommended (venues with kind='stay') across all visible trips. */
export const useUserStays = (userId: string | null | undefined) =>
  useQuery({
    queryKey: ['profile', 'stays', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<DerivedRow[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('venues')
        .select('id, name, quote, kind, places!inner(trip_id, trips!inner(id, title, user_id))')
        .eq('kind', 'stay')
        .eq('places.trips.user_id', userId);
      if (error) throw error;
      type Raw = {
        id: string;
        name: string;
        quote: string | null;
        kind: string;
        places: { trip_id: string; trips: { id: string; title: string } } | null;
      };
      const out: DerivedRow[] = [];
      for (const r of data as unknown as Raw[]) {
        if (!r.places?.trips) continue;
        out.push({
          id: r.id,
          name: r.name,
          quote: r.quote,
          kind: r.kind,
          trip_id: r.places.trips.id,
          trip_title: r.places.trips.title,
        });
      }
      return out;
    },
  });

/** Places (cities/regions) this user has been to. */
export const useUserPlaces = (userId: string | null | undefined) =>
  useQuery({
    queryKey: ['profile', 'places', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<DerivedRow[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('places')
        .select('id, name, trip_id, trips!inner(id, title, user_id)')
        .eq('trips.user_id', userId);
      if (error) throw error;
      type Raw = {
        id: string;
        name: string;
        trip_id: string;
        trips: { id: string; title: string };
      };
      return (data as unknown as Raw[]).map((r) => ({
        id: r.id,
        name: r.name,
        quote: null,
        trip_id: r.trip_id,
        trip_title: r.trips.title,
      }));
    },
  });

/** Tips authored across this user's trips. */
export const useUserTips = (userId: string | null | undefined) =>
  useQuery({
    queryKey: ['profile', 'tips', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<DerivedRow[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      // We need to join through trip OR place to the trip-owner. Easiest:
      // fetch the user's trips, then fetch tips by parent_id in either set.
      const { data: trips, error: tripsErr } = await supabase
        .from('trips')
        .select('id, title')
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (tripsErr) throw tripsErr;
      if (!trips || trips.length === 0) return [];

      const tripIds = trips.map((t) => t.id);
      const titleByTripId = new Map(trips.map((t) => [t.id as string, t.title as string]));

      const { data: places, error: placesErr } = await supabase
        .from('places')
        .select('id, trip_id')
        .in('trip_id', tripIds);
      if (placesErr) throw placesErr;
      const placeToTrip = new Map((places ?? []).map((p) => [p.id as string, p.trip_id as string]));

      const tipParents = [
        ...tripIds.map((id) => ({ type: 'trip', id })),
        ...(places ?? []).map((p) => ({ type: 'place', id: p.id as string })),
      ];
      if (tipParents.length === 0) return [];

      // Two queries (trip-tips, place-tips) is simpler than an OR.
      const [tripTipsRes, placeTipsRes] = await Promise.all([
        supabase
          .from('tips')
          .select('id, body, parent_id')
          .eq('parent_type', 'trip')
          .in('parent_id', tripIds)
          .is('deleted_at', null),
        (places ?? []).length === 0
          ? Promise.resolve({
              data: [] as { id: string; body: string; parent_id: string }[],
              error: null,
            })
          : supabase
              .from('tips')
              .select('id, body, parent_id')
              .eq('parent_type', 'place')
              .in(
                'parent_id',
                (places ?? []).map((p) => p.id),
              )
              .is('deleted_at', null),
      ]);
      if (tripTipsRes.error) throw tripTipsRes.error;
      if (placeTipsRes.error) throw placeTipsRes.error;

      const rows: DerivedRow[] = [];
      for (const t of tripTipsRes.data ?? []) {
        rows.push({
          id: t.id as string,
          name: t.body as string,
          quote: null,
          trip_id: t.parent_id as string,
          trip_title: titleByTripId.get(t.parent_id as string) ?? '',
        });
      }
      for (const t of placeTipsRes.data ?? []) {
        const tripId = placeToTrip.get(t.parent_id as string);
        if (!tripId) continue;
        rows.push({
          id: t.id as string,
          name: t.body as string,
          quote: null,
          trip_id: tripId,
          trip_title: titleByTripId.get(tripId) ?? '',
        });
      }
      return rows;
    },
  });
