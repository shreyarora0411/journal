import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { type QuickLogForm, QuickLogFormSchema, type Trip } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tripKeys } from './keys';

type Result = { trip: Trip; placeId: string };

/**
 * Creates a trip + a single seed place from Quick mode form data.
 * Detailed mode uses a separate flow that creates additional places after.
 *
 * After save, fires the extract-entities edge function (best-effort) to
 * stage entity proposals for the confirmation screen.
 */
export const useCreateTripQuick = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (input: QuickLogForm): Promise<Result> => {
      if (!userId) throw new Error('Not signed in');
      const parsed = QuickLogFormSchema.parse(input);

      const supabase = getSupabase();

      // 1. Trip row.
      const { data: trip, error: tripErr } = await supabase
        .from('trips')
        .insert({
          user_id: userId,
          title: parsed.title,
          start_date: parsed.start_date ?? null,
          end_date: parsed.end_date ?? null,
          note: parsed.note ?? null,
          visibility: parsed.visibility,
        })
        .select('*')
        .single();
      if (tripErr) throw tripErr;

      // 2. Seed place from the trip's place_name.
      const { data: place, error: placeErr } = await supabase
        .from('places')
        .insert({
          trip_id: (trip as Trip).id,
          name: parsed.place_name,
          position: 0,
        })
        .select('id')
        .single();
      if (placeErr) throw placeErr;

      // 3. Fire-and-forget extraction. We don't block save on this.
      supabase.functions
        .invoke('extract-entities', { body: { trip_id: (trip as Trip).id } })
        .catch((err) => log.warn('extract-entities invoke failed', { error: String(err) }));

      log.event('trip.created', { mode: 'quick' });
      return { trip: trip as Trip, placeId: (place as { id: string }).id };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: tripKeys.list(userId) });
      qc.setQueryData(tripKeys.detail(result.trip.id), null); // force refetch on view
    },
  });
};
