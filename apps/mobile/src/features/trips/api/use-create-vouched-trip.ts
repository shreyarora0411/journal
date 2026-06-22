import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { type TripComposer, TripComposerSchema } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type Result = { tripId: string; vouchCount: number };

/**
 * Vouched v3 save: create a Trip (container) + its category-slotted Vouches
 * in one flow. No extraction — each vouch arrives already typed by the
 * composer slot the user wrote it into.
 *
 * The trip carries the verdict + destination (no prose blob in v0). Each
 * vouch carries the user's verbatim text, its vouch_type, the denormalized
 * destination, and source='user_created'. Vouch visibility is clamped to
 * the parent trip's so a vouch can't leak wider than its trip.
 */
export const useCreateVouchedTrip = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (input: TripComposer): Promise<Result> => {
      if (!userId) throw new Error('Not signed in');
      const parsed = TripComposerSchema.parse(input);
      const supabase = getSupabase();

      // 1. The trip container. title falls back to the destination
      //    (v3: title auto-generated if empty).
      const { data: trip, error: tripErr } = await supabase
        .from('trips')
        .insert({
          user_id: userId,
          title: parsed.destination_text,
          destination_text: parsed.destination_text,
          verdict: parsed.verdict,
          trip_context: parsed.trip_context ?? null,
          visibility: parsed.visibility,
        })
        .select('id')
        .single();
      if (tripErr) throw tripErr;
      const tripId = (trip as { id: string }).id;

      // 2. The vouches. Schema guarantees >=1.
      const rows = parsed.vouches.map((v) => ({
        trip_id: tripId,
        user_id: userId,
        text: v.text,
        vouch_type: v.vouch_type,
        destination_text: parsed.destination_text,
        source: 'user_created' as const,
        visibility: parsed.visibility,
      }));
      const { error: vouchErr } = await supabase.from('vouches').insert(rows);
      if (vouchErr) {
        // Trip saved, vouches didn't. A trip with zero vouches helps no one
        // and would orphan in the feed/search — roll it back so a retry
        // starts clean rather than leaving a dead trip behind. (No multi-
        // statement transaction over the JS client, so we compensate.)
        log.error('vouches insert failed after trip create — rolling back trip', vouchErr);
        await supabase.from('trips').delete().eq('id', tripId);
        throw vouchErr;
      }

      log.event('trip.vouched', { vouch_count: rows.length, verdict: parsed.verdict });
      return { tripId, vouchCount: rows.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed', userId] });
      qc.invalidateQueries({ queryKey: ['profile', 'trips', userId] });
      qc.invalidateQueries({ queryKey: ['vouches'] });
    },
  });
};
