import { getSupabase } from '@/lib/supabase';
import type { Trip } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';

/** A trip plus the small child-counts the profile uses to render the
 *  `X venues · Y cities · Z photos` summary line per Round 2 spec. */
export type TripWithCounts = Trip & {
  cities_count: number;
  venues_count: number;
  trip_photos_count: number;
};

/**
 * Trips authored by a specific user. RLS filters out anything the viewer
 * isn't allowed to see, so for a non-follow this returns only 'everyone'
 * trips, for a follower the 'followers' + 'everyone' set, etc.
 *
 * Embeds child counts via PostgREST's `relation(count)` syntax so the
 * profile can show `X venues · Y cities · Z photos` without an N+1
 * query per card.
 */
export const useUserTrips = (userId: string | null | undefined) =>
  useQuery({
    queryKey: ['profile', 'trips', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<TripWithCounts[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('trips')
        .select(
          '*, cities_count:cities(count), venues_count:venues(count), trip_photos_count:trip_photos(count)',
        )
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // PostgREST returns each count as [{ count: N }]. Flatten so the
      // consumer reads `.venues_count` as a number.
      type Raw = Trip & {
        cities_count: { count: number }[];
        venues_count: { count: number }[];
        trip_photos_count: { count: number }[];
      };
      const rows = (data ?? []) as unknown as Raw[];
      return rows.map((r) => ({
        ...r,
        cities_count: r.cities_count?.[0]?.count ?? 0,
        venues_count: r.venues_count?.[0]?.count ?? 0,
        trip_photos_count: r.trip_photos_count?.[0]?.count ?? 0,
      }));
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
        .select('id, name, quote, kind, cities!inner(trip_id, trips!inner(id, title, user_id))')
        .eq('kind', 'stay')
        .eq('cities.trips.user_id', userId);
      if (error) throw error;
      type Raw = {
        id: string;
        name: string;
        quote: string | null;
        kind: string;
        cities: { trip_id: string; trips: { id: string; title: string } } | null;
      };
      const out: DerivedRow[] = [];
      for (const r of data as unknown as Raw[]) {
        if (!r.cities?.trips) continue;
        out.push({
          id: r.id,
          name: r.name,
          quote: r.quote,
          kind: r.kind,
          trip_id: r.cities.trips.id,
          trip_title: r.cities.trips.title,
        });
      }
      return out;
    },
  });

/** Cities this user has been to. */
export const useUserPlaces = (userId: string | null | undefined) =>
  useQuery({
    queryKey: ['profile', 'cities', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<DerivedRow[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('cities')
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

      const { data: cities, error: citiesErr } = await supabase
        .from('cities')
        .select('id, trip_id')
        .in('trip_id', tripIds);
      if (citiesErr) throw citiesErr;
      const cityToTrip = new Map((cities ?? []).map((c) => [c.id as string, c.trip_id as string]));

      const tipParents = [
        ...tripIds.map((id) => ({ type: 'trip', id })),
        ...(cities ?? []).map((c) => ({ type: 'city', id: c.id as string })),
      ];
      if (tipParents.length === 0) return [];

      // Two queries (trip-tips, city-tips) is simpler than an OR.
      const [tripTipsRes, cityTipsRes] = await Promise.all([
        supabase
          .from('tips')
          .select('id, body, parent_id')
          .eq('parent_type', 'trip')
          .in('parent_id', tripIds)
          .is('deleted_at', null),
        (cities ?? []).length === 0
          ? Promise.resolve({
              data: [] as { id: string; body: string; parent_id: string }[],
              error: null,
            })
          : supabase
              .from('tips')
              .select('id, body, parent_id')
              .eq('parent_type', 'city')
              .in(
                'parent_id',
                (cities ?? []).map((c) => c.id),
              )
              .is('deleted_at', null),
      ]);
      if (tripTipsRes.error) throw tripTipsRes.error;
      if (cityTipsRes.error) throw cityTipsRes.error;

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
      for (const t of cityTipsRes.data ?? []) {
        const tripId = cityToTrip.get(t.parent_id as string);
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
