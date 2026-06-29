import { useAuthStore } from '@/features/auth';
import { placeAutocomplete, placeDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import type { VouchType } from '@journal/shared';
import { useCallback } from 'react';

/** Vouch types that map to a single physical venue worth geocoding. Mirrors
 *  use-resolve-vouch-place — good_to_know / skip have no one pin. */
const PLACE_TYPES: VouchType[] = ['stay', 'eat_drink', 'do', 'nightlife'];

/** Cap per run so a backfill kicked on mount never fans out into a long burst
 *  of Google calls. Already-resolved vouches are excluded by the place_id
 *  filter, so repeated runs drain the remainder a batch at a time. */
const BACKFILL_CAP = 20;

type PendingVouch = {
  id: string;
  text: string;
  vouch_type: VouchType;
  destination_text: string;
};

/**
 * Backfill place links for the current user's existing place-type vouches —
 * the ones saved before background resolution existed (or whose earlier
 * resolution missed). Runs the SAME lead -> autocomplete -> details -> RPC
 * pipeline as use-resolve-vouch-place, sequentially and capped, so it stays a
 * quiet background drip.
 *
 * Safe to call repeatedly: the query only pulls vouches with place_id IS NULL,
 * so anything already resolved is skipped, and each run chips away at the rest.
 * Entirely best-effort — every error is swallowed via log.warn.
 */
export const useBackfillMyPlaces = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useCallback(async (): Promise<void> => {
    if (!userId) return;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('vouches')
      .select('id, text, vouch_type, destination_text')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .is('place_id', null)
      .in('vouch_type', PLACE_TYPES)
      .limit(BACKFILL_CAP);
    if (error) {
      log.warn('backfill places query failed', { error: String(error) });
      return;
    }

    const pending = (data ?? []) as PendingVouch[];
    // Sequential, not parallel — a burst of concurrent Google calls would be
    // both wasteful and rate-limit-prone. This is background work; slow is fine.
    for (const v of pending) {
      try {
        const lead = v.text.split(/[—–\-,.]/)[0]?.trim() || v.text;
        const hits = await placeAutocomplete(`${lead}, ${v.destination_text}`);
        if (!hits[0]) continue;
        const d = await placeDetails(hits[0].placeId);
        if (!d?.google_place_id) continue;
        const { error: rpcErr } = await supabase.rpc('resolve_vouch_place', {
          p_vouch_id: v.id,
          p_google_place_id: d.google_place_id,
          p_name: d.name,
          p_destination: v.destination_text,
          p_lat: d.lat,
          p_lng: d.lng,
        });
        if (rpcErr) throw rpcErr;
      } catch (err) {
        // One vouch failing must not abort the rest of the batch.
        log.warn('backfill resolve failed for vouch', { vouchId: v.id, error: String(err) });
      }
    }
  }, [userId]);
};
