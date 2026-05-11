import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * One canonical place groups all per-trip place rows with the same lowercased
 * name and (optionally) country. Backed by the `canonical_places` view from
 * migration 0005.
 */
export type CanonicalPlace = {
  canonical_key: string;
  canonical_name: string;
  display_name: string;
  country: string | null;
  place_ids: string[];
  trip_ids: string[];
  user_ids: string[];
  saved_by_count: number;
};

export type PlaceSighting = {
  place_id: string;
  trip_id: string;
  trip_title: string;
  user_id: string;
  user: {
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null;
  /** Optional quote — for venues this is the friend's exact words. */
  quote: string | null;
  /** Place type when known — hotel/restaurant/etc. */
  kind: string | null;
  created_at: string;
};

/**
 * Fetch a canonical place by name+country, plus all sightings (one row per
 * friend who has saved/named this place across their trips).
 *
 * RLS on the underlying places/venues/trips tables filters automatically —
 * we only ever see places attached to trips visible to us.
 */
export const useCanonicalPlace = (name: string | null, country: string | null) =>
  useQuery({
    queryKey: ['canonical-place', name, country],
    enabled: Boolean(name && name.length > 0),
    queryFn: async (): Promise<{
      canonical: CanonicalPlace | null;
      sightings: PlaceSighting[];
    }> => {
      if (!name) return { canonical: null, sightings: [] };
      const supabase = getSupabase();

      let canonicalQ = supabase
        .from('canonical_places')
        .select('*')
        .eq('canonical_name', name.toLowerCase());
      if (country) canonicalQ = canonicalQ.eq('country', country);
      const { data: canonicalRows, error: canonicalErr } = await canonicalQ.limit(1);
      if (canonicalErr && canonicalErr.code !== '42P01') throw canonicalErr;
      const canonical = (canonicalRows?.[0] ?? null) as CanonicalPlace | null;

      // Pull the actual per-trip rows so we can show each friend's voice.
      // Match by lowercased name and (optionally) country.
      let placesQ = supabase
        .from('places')
        .select(
          'id, name, country, note, created_at, trip:trip_id(id, title, user_id, author:user_id(id, display_name, handle, avatar_url))',
        )
        .ilike('name', name.trim())
        .is('deleted_at', null);
      if (country) placesQ = placesQ.eq('country', country);
      const { data: placeRows, error: placesErr } = await placesQ;
      if (placesErr) throw placesErr;

      type Raw = {
        id: string;
        name: string;
        country: string | null;
        note: string | null;
        created_at: string;
        trip: {
          id: string;
          title: string;
          user_id: string;
          author: PlaceSighting['user'];
        } | null;
      };
      const sightings: PlaceSighting[] = [];
      for (const r of (placeRows ?? []) as unknown as Raw[]) {
        const trip = r.trip;
        if (!trip) continue;
        sightings.push({
          place_id: r.id,
          trip_id: trip.id,
          trip_title: trip.title,
          user_id: trip.user_id,
          user: trip.author,
          quote: r.note,
          kind: null,
          created_at: r.created_at,
        });
      }
      sightings.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

      return { canonical, sightings };
    },
  });
