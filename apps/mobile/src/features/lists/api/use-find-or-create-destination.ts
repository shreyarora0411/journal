import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation } from '@tanstack/react-query';

type Vars = { name: string; country?: string | null };

/**
 * Idempotent destination lookup. We can't rely on PostgREST upsert with a
 * functional unique index, so this is a two-step: select-by-lowername, then
 * insert if missing.
 */
export const useFindOrCreateDestination = () =>
  useMutation({
    mutationFn: async ({ name, country }: Vars): Promise<string> => {
      const cleanName = name.trim();
      const cleanCountry = country?.trim() ?? null;
      if (cleanName.length === 0) throw new Error('Destination name required');
      const supabase = getSupabase();

      const { data: existing } = await supabase
        .from('destinations')
        .select('id')
        .ilike('name', cleanName)
        .maybeSingle();
      if (existing) return (existing as { id: string }).id;

      const { data: created, error } = await supabase
        .from('destinations')
        .insert({ name: cleanName, country: cleanCountry })
        .select('id')
        .single();
      if (error) throw error;
      log.event('destination.created');
      return (created as { id: string }).id;
    },
  });
