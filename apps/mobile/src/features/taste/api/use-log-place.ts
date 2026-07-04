import { useAuthStore } from '@/features/auth';
import type { PlaceDetails } from '@/lib/google-places';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { type Sentiment, categoryToVouchType, inferZone } from '@journal/shared';
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
  /** Optional ≤3 format-tag slugs. */
  tags?: string[];
  /** Optional single occasion-tag slug — Go Out's occasion filter matches
   *  on these votes, so they must be castable at log time. */
  occasion?: string | null;
  /** Optional curated hub/zone (from the hub chips when known). */
  hub?: string | null;
  zone?: string | null;
};

export type LogPlaceResult = {
  placeId: string;
  /** False when the voiced note failed to persist — the screen must NOT
   *  claim full success and must keep the typed note recoverable. */
  noteSaved: boolean;
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
    // iOS reuses kept-alive sockets the server already closed; the first write
    // after idle then dies with "Network request failed" while reads (which
    // retry by default) recover invisibly. Retrying is safe: every step that
    // can throw here is idempotent (find_or_create keyed on google_place_id,
    // reaction upsert keyed on user+place; note/tags never throw).
    retry: 2,
    retryDelay: 400,
    mutationFn: async (vars: LogPlaceVars): Promise<LogPlaceResult> => {
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
        // Safety net for every capture door (log screen, pick-5): a place
        // with no zone can never surface in Go Out, so infer from coords
        // when the caller didn't decide. Out-of-market stays null.
        p_zone: vars.zone ?? inferZone(vars.place.lat, vars.place.lng),
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

      // Best-effort extras — a failed note/tag never fails the log, but the
      // note outcome is REPORTED so the screen never lies about it.
      let noteSaved = true;
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
        if (vouchErr) {
          noteSaved = false;
          log.warn('log-place note skipped', { error: vouchErr.message });
        }
      }
      const votes = [...(vars.tags ?? []).slice(0, 3), ...(vars.occasion ? [vars.occasion] : [])];
      if (votes.length > 0) {
        // Delete-then-insert, NOT upsert: ON CONFLICT's arbiter needs SELECT
        // on user_id, which the de-attribution column grant (mig 55)
        // deliberately withholds — the upsert always failed with permission
        // denied. RLS scopes both statements to own rows, and replacing
        // means a re-log restates your current tags.
        const { error: clearErr } = await supabase
          .from('place_tag_votes')
          .delete()
          .eq('place_id', pid);
        const { error: tagErr } = clearErr
          ? { error: clearErr }
          : await supabase
              .from('place_tag_votes')
              .insert(votes.map((slug) => ({ user_id: userId, place_id: pid, tag_slug: slug })));
        if (tagErr) log.warn('log-place tags skipped', { error: tagErr.message });
      }

      log.event('taste.place_logged', {
        sentiment: vars.sentiment,
        tags: votes.length,
        occasion: vars.occasion ?? 'none',
      });
      return { placeId: pid, noteSaved };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taste'] });
      qc.invalidateQueries({ queryKey: ['vouches'] });
    },
  });
};
