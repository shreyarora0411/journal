import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';

export type PlaceSignalKind =
  | 'maps_opened'
  | 'place_shared'
  | 'taste_card_shared'
  | 'wishlist_add'
  | 'list_add';

/**
 * Records an implicit intent signal into place_interactions (migration 68) —
 * a parallel channel to log.event, which goes to PostHog and is invisible to
 * the taste engine. Nothing ranks on these yet; they're captured now so the
 * future ranking layers in docs/taste-engine-v2.md have history to learn
 * from instead of starting cold.
 *
 * Fire-and-forget by contract: never await this in a UI path, and a failed
 * insert must never break the interaction it decorates.
 */
export const recordPlaceSignal = (kind: PlaceSignalKind, placeId?: string | null): void => {
  try {
    const supabase = getSupabase();
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id;
      if (!userId) return;
      const { error } = await supabase.from('place_interactions').insert({
        user_id: userId,
        place_id: placeId ?? null,
        kind,
      });
      if (error) log.warn('place signal insert failed', { kind, error: error.message });
    })().catch(() => undefined);
  } catch {
    // getSupabase can throw when env isn't configured — a signal is never
    // worth surfacing an error for.
  }
};
