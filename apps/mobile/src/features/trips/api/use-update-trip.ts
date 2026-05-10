import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { type Trip, type Visibility, VisibilitySchema } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tripKeys } from './keys';

type Vars = {
  id: string;
  patch: Partial<{
    title: string;
    note: string | null;
    start_date: string | null;
    end_date: string | null;
    visibility: Visibility;
    cover_photo_id: string | null;
  }>;
};

export const useUpdateTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: Vars): Promise<Trip> => {
      if (patch.visibility) VisibilitySchema.parse(patch.visibility);
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('trips')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      log.event('trip.updated');
      return data as Trip;
    },
    onSuccess: (trip) => {
      qc.invalidateQueries({ queryKey: tripKeys.detail(trip.id) });
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
};

export const useDeleteTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('trips')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      log.event('trip.deleted');
    },
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ queryKey: tripKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
};
