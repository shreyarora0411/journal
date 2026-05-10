import { getSupabase } from '@/lib/supabase';
import type { Area, Place, Tip, Trip, TripPhoto, Venue } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';
import { tripKeys } from './keys';

export type TripWithChildren = Trip & {
  places: (Place & { venues: Venue[]; areas: Area[] })[];
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

      const [tripRes, placesRes, photosRes, tripTipsRes] = await Promise.all([
        supabase.from('trips').select('*').eq('id', tripId).is('deleted_at', null).maybeSingle(),
        supabase
          .from('places')
          .select('*, venues(*), areas(*)')
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
      if (placesRes.error) throw placesRes.error;
      if (photosRes.error) throw photosRes.error;
      if (tripTipsRes.error) throw tripTipsRes.error;
      if (!tripRes.data) return null;

      type RawPlace = Place & { venues: Venue[] | null; areas: Area[] | null };
      const places = ((placesRes.data ?? []) as unknown as RawPlace[]).map((p) => ({
        ...p,
        venues: (p.venues ?? []).filter((v) => v.deleted_at == null),
        areas: (p.areas ?? []).filter((a) => a.deleted_at == null),
      }));

      return {
        ...(tripRes.data as Trip),
        places,
        photos: (photosRes.data ?? []) as TripPhoto[],
        trip_tips: (tripTipsRes.data ?? []) as Tip[],
      };
    },
  });
