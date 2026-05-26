import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { type AtomicLogForm, AtomicLogFormSchema } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Resolves a Google Places pick → (resolved_kind, country/city/area
 * ids). Calls the `resolve_google_place` RPC from migration 32. The
 * client should run this *before* insert_atomic_log so the venue insert
 * has a `city_id` to attach to.
 */
export type ResolvedPlace = {
  resolved_kind: 'country' | 'city' | 'area' | 'venue';
  country_id: string | null;
  city_id: string | null;
  area_id: string | null;
  venue_id: string | null;
};

export type ResolvePlaceVars = {
  google_place_id: string;
  name: string;
  types: string[];
  lat: number | null;
  lng: number | null;
  country_iso2: string | null;
  country_name: string | null;
  parent_locality_name: string | null;
  parent_locality_place_id: string | null;
};

export const useResolvePlace = () =>
  useMutation({
    mutationFn: async (vars: ResolvePlaceVars): Promise<ResolvedPlace> => {
      const { data, error } = await getSupabase()
        .rpc('resolve_google_place', {
          p_google_place_id: vars.google_place_id,
          p_name: vars.name,
          p_types: vars.types,
          p_lat: vars.lat,
          p_lng: vars.lng,
          p_country_iso2: vars.country_iso2,
          p_country_name: vars.country_name,
          p_parent_locality_name: vars.parent_locality_name,
          p_parent_locality_place_id: vars.parent_locality_place_id,
        })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('resolve_google_place returned no row');
      return data as ResolvedPlace;
    },
  });

/**
 * Writes the venue row that holds the atomic log's category, one_line,
 * prose, optional trip_id, and visibility. Returns the new venue uuid.
 *
 * Caller flow (AtomicLogForm onSubmit):
 *   1. resolve = await useResolvePlace.mutateAsync(...)
 *   2. venueId = await useCreateAtomicLog.mutateAsync({ ...form, city_id: resolve.city_id, area_id: resolve.area_id })
 *   3. await useSetVerdict.mutateAsync({ target_type: 'venue', target_id: venueId, verdict })
 *   4. For each picked list: useAddPolymorphicListItem with target_type='venue'
 */
export type CreateAtomicLogVars = AtomicLogForm & {
  city_id: string | null;
  area_id: string | null;
};

export const useCreateAtomicLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAtomicLogVars): Promise<string> => {
      const parsed = AtomicLogFormSchema.parse(input);
      const { data, error } = await getSupabase().rpc('insert_atomic_log', {
        p_city_id: input.city_id,
        p_area_id: input.area_id,
        p_google_place_id: parsed.google_place_id,
        p_name: parsed.name,
        p_lat: parsed.lat ?? null,
        p_lng: parsed.lng ?? null,
        p_category: parsed.category,
        p_one_line: parsed.one_line,
        p_prose: parsed.prose ?? null,
        p_trip_id: parsed.trip_id ?? null,
        p_visibility: parsed.visibility,
      });
      if (error) throw error;
      if (!data) throw new Error('insert_atomic_log returned no id');
      log.event('atomic_log.created', { category: parsed.category });
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['me-stats'] });
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });
};
