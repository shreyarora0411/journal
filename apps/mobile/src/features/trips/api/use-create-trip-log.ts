import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { log } from '@/lib/log';
import {
  type ComposerForm,
  ComposerFormSchema,
  type ConfirmedTip,
  type TripVerdict,
  type Visibility,
} from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type Vars = {
  form: ComposerForm;
  /** The tips the user confirmed in the review screen. May be empty —
   *  a note with no extractable tip still saves (the nudge is a soft
   *  gate, not a block). */
  tips: ConfirmedTip[];
};

type Result = { tripId: string; tipCount: number };

/**
 * Persists a TripLog (= trips row) plus its confirmed LogTips in one go.
 *
 * The trip's `note` column holds the original_note (source of truth). The
 * composer's destination/verdict/context land on the new v2 columns. Each
 * confirmed tip becomes a log_tips row carrying the friend's wording,
 * advice_type, and the trip's destination (denormalized for search).
 *
 * Visibility cascades: a tip can't be more visible than its parent log.
 */
export const useCreateTripLog = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async ({ form, tips }: Vars): Promise<Result> => {
      if (!userId) throw new Error('Not signed in');
      const parsed = ComposerFormSchema.parse(form);
      const supabase = getSupabase();
      const visibility: Visibility = parsed.visibility;
      const verdict: TripVerdict | null = parsed.verdict ?? null;

      // 1. The trip log. title falls back to the destination if the
      //    composer didn't capture one (v2: title auto-generated if empty).
      const { data: trip, error: tripErr } = await supabase
        .from('trips')
        .insert({
          user_id: userId,
          title: parsed.destination_text,
          note: parsed.original_note,
          destination_text: parsed.destination_text,
          verdict,
          trip_context: parsed.did_differently ?? null,
          visibility,
        })
        .select('id')
        .single();
      if (tripErr) throw tripErr;
      const tripId = (trip as { id: string }).id;

      // 2. The confirmed tips. Clamp each tip's visibility to the parent
      //    log's visibility so a tip can't leak wider than its trip.
      if (tips.length > 0) {
        const rows = tips.map((t) => ({
          trip_id: tripId,
          user_id: userId,
          text: t.text,
          advice_type: t.advice_type,
          area_text: t.area_text ?? null,
          destination_text: parsed.destination_text,
          extraction_status: t.extraction_status,
          confidence: t.confidence ?? null,
          visibility,
        }));
        const { error: tipsErr } = await supabase.from('log_tips').insert(rows);
        if (tipsErr) {
          // The trip saved; the tips didn't. Surface it rather than leaving
          // a silent half-save — the caller can offer a retry on the tips.
          log.error('log_tips insert failed after trip create', tipsErr);
          throw tipsErr;
        }
      }

      log.event('trip_log.created', { tip_count: tips.length, has_verdict: verdict != null });
      return { tripId, tipCount: tips.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed', userId] });
      qc.invalidateQueries({ queryKey: ['profile', 'trips', userId] });
      qc.invalidateQueries({ queryKey: ['log-tips'] });
    },
  });
};
