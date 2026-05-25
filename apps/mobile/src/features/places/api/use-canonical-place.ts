import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * One canonical city groups all per-trip city rows with the same lowercased
 * name and (optionally) country. Backed by the `canonical_cities` view from
 * migration 24 (formerly `canonical_places`, renamed in the geographic-
 * hierarchy refactor).
 *
 * The hook name keeps "Place" / "canonicalPlace" linguistically — UI calls
 * these "places" — but the underlying entity is the city table.
 */
export type CanonicalPlace = {
  canonical_key: string;
  canonical_name: string;
  display_name: string;
  country_id: string | null;
  country_name: string | null;
  country_iso: string | null;
  city_ids: string[];
  trip_ids: string[];
  user_ids: string[];
  saved_by_count: number;
};

export type PlaceSighting = {
  city_id: string;
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
 * Fetch a canonical city by name + (optional) country iso, plus all
 * sightings — one row per friend who has saved/named this city across
 * their trips.
 *
 * RLS on the underlying cities/venues/trips tables filters automatically —
 * we only ever see cities attached to trips visible to us.
 */
export const useCanonicalPlace = (name: string | null, country: string | null) =>
  useQuery({
    queryKey: ['canonical-city', name, country],
    enabled: Boolean(name && name.length > 0),
    queryFn: async (): Promise<{
      canonical: CanonicalPlace | null;
      sightings: PlaceSighting[];
    }> => {
      if (!name) return { canonical: null, sightings: [] };
      const supabase = getSupabase();

      // Resolve country text (long name or ISO) → country_id if we can.
      // The caller is presently passing either the display name (legacy)
      // or null; we accept either and look up by display_name.
      let countryId: string | null = null;
      if (country) {
        const upper = country.toUpperCase();
        const lookup = supabase.from('countries').select('id');
        const { data: cRow } = await (upper.length === 2
          ? lookup.eq('iso_alpha2', upper).maybeSingle()
          : lookup.ilike('display_name', country).maybeSingle());
        countryId = (cRow as { id: string } | null)?.id ?? null;
      }

      let canonicalQ = supabase
        .from('canonical_cities')
        .select('*')
        .eq('canonical_name', name.toLowerCase());
      if (countryId) canonicalQ = canonicalQ.eq('country_id', countryId);
      const { data: canonicalRows, error: canonicalErr } = await canonicalQ.limit(1);
      if (canonicalErr && canonicalErr.code !== '42P01') throw canonicalErr;
      const canonical = (canonicalRows?.[0] ?? null) as CanonicalPlace | null;

      // Pull the actual per-trip rows so we can show each friend's voice.
      // Match by lowercased name and (optionally) country.
      let citiesQ = supabase
        .from('cities')
        .select(
          'id, name, country_id, note, created_at, trip:trip_id(id, title, user_id, author:user_id(id, display_name, handle, avatar_url))',
        )
        .ilike('name', name.trim())
        .is('deleted_at', null);
      if (countryId) citiesQ = citiesQ.eq('country_id', countryId);
      const { data: cityRows, error: citiesErr } = await citiesQ;
      if (citiesErr) throw citiesErr;

      type Raw = {
        id: string;
        name: string;
        country_id: string | null;
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
      for (const r of (cityRows ?? []) as unknown as Raw[]) {
        const trip = r.trip;
        if (!trip) continue;
        sightings.push({
          city_id: r.id,
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
