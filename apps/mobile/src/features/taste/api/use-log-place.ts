import { useAuthStore } from '@/features/auth';
import type { PlaceDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { type Sentiment, categoryToVouchType } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/** Google place types → our category_priors key. Heuristic, founder-correctable
 *  server-side (curated category always wins in find_or_create_place). */
export const googleTypesToCategory = (types: string[]): string => {
  const t = new Set(types);
  if (t.has('night_club')) return 'club';
  if (t.has('bar') && t.has('restaurant')) return 'bar';
  if (t.has('bar')) return 'bar';
  if (t.has('cafe') || t.has('coffee_shop')) return 'cafe';
  if (t.has('bakery')) return 'bakery_dessert';
  return 'restaurant';
};

export type LogPlaceVars = {
  place: PlaceDetails;
  sentiment: Sentiment;
  /** Optional voiced note — becomes a public vouch attached to the place. */
  note?: string;
  /** Optional ≤3 taste-tag slugs. */
  tags?: string[];
  /** Optional curated hub/zone (from the hub chips when known). */
  hub?: string | null;
  zone?: string | null;
};

/**
 * The Log door (spec §3): place → one-tap loved/fine/skip → optional voiced
 * note → optional tags. One mutation does all four writes:
 *   1. find_or_create_place (definer RPC — curated fields win)
 *   2. upsert the PRIVATE reaction (own-row RLS)
 *   3. optional public vouch (the voiced note, visibility friends_of_friends)
 *   4. optional tag votes (de-attributed to other clients)
 * The reaction is the required core; note/tags are best-effort extras that
 * must never fail the log.
 */
export const useLogPlace = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (vars: LogPlaceVars): Promise<{ placeId: string }> => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();

      const { data: placeId, error: placeErr } = await supabase.rpc('find_or_create_place', {
        p_google_place_id: vars.place.google_place_id,
        p_name: vars.place.name,
        p_destination_text: vars.place.locality ?? vars.place.region ?? null,
        p_lat: vars.place.lat,
        p_lng: vars.place.lng,
        p_category: googleTypesToCategory(vars.place.types),
        p_hub: vars.hub ?? null,
        p_zone: vars.zone ?? null,
      });
      if (placeErr) throw placeErr;
      const pid = placeId as string;

      const { error: reactErr } = await supabase
        .from('place_reactions')
        .upsert(
          { user_id: userId, place_id: pid, sentiment: vars.sentiment },
          { onConflict: 'user_id,place_id' },
        );
      if (reactErr) throw reactErr;

      // Best-effort extras — a failed note/tag never fails the log.
      const note = vars.note?.trim();
      if (note) {
        const { error: vouchErr } = await supabase.from('vouches').insert({
          user_id: userId,
          text: note.slice(0, 500),
          vouch_type: categoryToVouchType(googleTypesToCategory(vars.place.types)),
          destination_text: vars.place.locality ?? vars.place.name,
          place_id: pid,
          source: 'user_created',
          visibility: 'friends_of_friends',
        });
        if (vouchErr) log.warn('log-place note skipped', { error: vouchErr.message });
      }
      const tags = (vars.tags ?? []).slice(0, 3);
      if (tags.length > 0) {
        const { error: tagErr } = await supabase.from('place_tag_votes').upsert(
          tags.map((slug) => ({ user_id: userId, place_id: pid, tag_slug: slug })),
          { onConflict: 'user_id,place_id,tag_slug', ignoreDuplicates: true },
        );
        if (tagErr) log.warn('log-place tags skipped', { error: tagErr.message });
      }

      log.event('taste.place_logged', { sentiment: vars.sentiment, tags: tags.length });
      return { placeId: pid };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taste'] });
      qc.invalidateQueries({ queryKey: ['vouches'] });
    },
  });
};
