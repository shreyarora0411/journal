import { getSupabase } from '@/lib/supabase';
import type { Area, City, Country, Tip, Trip, TripPhoto, Venue } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';
import { tripKeys } from './keys';

/** A city joined with its canonical country (nullable for legacy / un-picked entries). */
export type CityWithCountry = City & {
  country: Pick<Country, 'id' | 'display_name' | 'iso_alpha2' | 'flag_emoji'> | null;
};

export type TripWithChildren = Trip & {
  cities: (CityWithCountry & { venues: Venue[]; areas: Area[] })[];
  trip_tips: Tip[];
  photos: TripPhoto[];
};

export const useTrip = (tripId: string | null | undefined) =>
  useQuery({
    queryKey: tripId ? tripKeys.detail(tripId) : tripKeys.detail('null'),
    enabled: Boolean(tripId),
    queryFn: async (): Promise<TripWithChildren | null> => {
      if (!tripId) return null;
      const supabase = getSupabase();

      const [tripRes, citiesRes, photosRes, tripTipsRes] = await Promise.all([
        supabase.from('trips').select('*').eq('id', tripId).is('deleted_at', null).maybeSingle(),
        supabase
          .from('cities')
          .select(
            '*, country:country_id(id, display_name, iso_alpha2, flag_emoji), venues(*), areas(*)',
          )
          .eq('trip_id', tripId)
          .is('deleted_at', null)
          .order('position', { ascending: true }),
        supabase
          .from('trip_photos')
          .select('*')
          .eq('trip_id', tripId)
          .is('deleted_at', null)
          .order('position', { ascending: true }),
        supabase
          .from('tips')
          .select('*')
          .eq('parent_type', 'trip')
          .eq('parent_id', tripId)
          .is('deleted_at', null),
      ]);

      if (tripRes.error) throw tripRes.error;
      if (citiesRes.error) throw citiesRes.error;
      if (photosRes.error) throw photosRes.error;
      if (tripTipsRes.error) throw tripTipsRes.error;
      if (!tripRes.data) return null;

      type RawCity = CityWithCountry & { venues: Venue[] | null; areas: Area[] | null };
      const cities = ((citiesRes.data ?? []) as unknown as RawCity[]).map((c) => ({
        ...c,
        venues: (c.venues ?? []).filter((v: Venue) => v.deleted_at == null),
        areas: (c.areas ?? []).filter((a: Area) => a.deleted_at == null),
      }));

      return {
        ...(tripRes.data as Trip),
        cities,
        photos: (photosRes.data ?? []) as TripPhoto[],
        trip_tips: (tripTipsRes.data ?? []) as Tip[],
      };
    },
  });
