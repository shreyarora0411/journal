import { placeAutocomplete, placeDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import type { VouchType } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/** Vouch types that map to a single physical venue worth geocoding. A
 *  good_to_know / skip note has no one pin, so it's a no-op. */
const PLACE_TYPES = new Set<VouchType>(['stay', 'eat_drink', 'do', 'nightlife']);

export type ResolveVouchPlaceVars = {
  vouchId: string;
  text: string;
  destinationText: string;
  vouchType: VouchType;
};

/**
 * Resolve a saved vouch to a canonical Google place — in the BACKGROUND,
 * never on the composer's critical path. Logging stays zero-friction; this
 * runs fire-and-forget AFTER a successful save and silently links the vouch
 * to a precise venue (google_place_id + lat/lng) so "Open in Maps" drops an
 * exact pin and per-venue consensus becomes possible later.
 *
 * The lead-phrase heuristic ("Lub'd Samui — private 2-bed" -> "Lub'd Samui")
 * mirrors the Maps deep-link, paired with the destination, then run through
 * autocomplete -> details -> the resolve_vouch_place RPC (owner-only upsert).
 *
 * EVERYTHING here is best-effort: any miss (non-place type, no autocomplete
 * hit, no place id, network/RPC error) is swallowed via log.warn. We never
 * toast and never throw — a failed resolution leaves the vouch exactly as it
 * was, just without a precise pin.
 */
export const useResolveVouchPlace = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vouchId,
      text,
      destinationText,
      vouchType,
    }: ResolveVouchPlaceVars): Promise<void> => {
      if (!PLACE_TYPES.has(vouchType)) return;

      // Lead phrase before the first dash/comma/period is usually the venue
      // name; pair it with the destination to disambiguate ("Smoky Joe's,
      // Udaipur").
      const lead = text.split(/[—–\-,.]/)[0]?.trim() || text;
      const hits = await placeAutocomplete(`${lead}, ${destinationText}`);
      if (!hits[0]) return;

      const d = await placeDetails(hits[0].placeId);
      if (!d?.google_place_id) return;

      const supabase = getSupabase();
      const { error } = await supabase.rpc('resolve_vouch_place', {
        p_vouch_id: vouchId,
        p_google_place_id: d.google_place_id,
        p_name: d.name,
        p_destination: destinationText,
        p_lat: d.lat,
        p_lng: d.lng,
      });
      if (error) throw error;
    },
    // Fire-and-forget: swallow ALL failures. A missing pin must never surface
    // to the user, block logging, or appear as anything but a quiet warning.
    onError: (err) => {
      log.warn('resolve_vouch_place failed', { error: String(err) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouch-search'] });
      qc.invalidateQueries({ queryKey: ['vouches'] });
    },
  });
};
