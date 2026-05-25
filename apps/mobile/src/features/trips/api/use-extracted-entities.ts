import { getSupabase } from '@/lib/supabase';
import type { ExtractedEntity } from '@journal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tripKeys } from './keys';

/**
 * Returns the staged (not-yet-confirmed and not-rejected) entities for a trip.
 * Used by the confirmation screen.
 */
export const useExtractedEntities = (tripId: string | null) =>
  useQuery({
    queryKey: tripId ? tripKeys.extracted(tripId) : tripKeys.extracted('null'),
    enabled: Boolean(tripId),
    refetchInterval: (query) => {
      const data = query.state.data as ExtractedEntity[] | undefined;
      // Keep polling until at least one row arrives (the extraction edge
      // function takes a few seconds). Stop once we have data or after 60s.
      const elapsed = Date.now() - query.state.dataUpdatedAt;
      if (!data || data.length === 0) return elapsed < 60_000 ? 2_000 : false;
      return false;
    },
    queryFn: async (): Promise<ExtractedEntity[]> => {
      if (!tripId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('extracted_entities')
        .select('*')
        .eq('trip_id', tripId)
        .eq('rejected', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ExtractedEntity[];
    },
  });

type ConfirmVars = {
  entityId: string;
  tripId: string;
  /** which city this entity belongs to. Defaults to the trip's first city. */
  cityId: string;
  /** allow editing the proposed values before confirming. */
  override?: { name?: string; quote?: string | null };
};

/**
 * Promote a staged extraction to a real venue/area/tip row.
 * Marks the staged row confirmed=true with a pointer to the new entity.
 */
export const useConfirmEntity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entityId, tripId, cityId, override }: ConfirmVars): Promise<void> => {
      const supabase = getSupabase();

      const { data: staged, error: fetchErr } = await supabase
        .from('extracted_entities')
        .select('*')
        .eq('id', entityId)
        .single();
      if (fetchErr) throw fetchErr;

      const proposedName = override?.name ?? (staged.proposed_name as string);
      const proposedQuote = override?.quote ?? (staged.proposed_quote as string | null);
      const meta = (staged.proposed_metadata as Record<string, unknown>) ?? {};

      let newId: string | null = null;

      if (staged.kind === 'venue') {
        const kind = ((meta.kind as string | undefined) ?? 'other') as
          | 'stay'
          | 'restaurant'
          | 'cafe'
          | 'nightlife'
          | 'other';
        const { data, error } = await supabase
          .from('venues')
          .insert({
            city_id: cityId,
            name: proposedName,
            kind,
            quote: proposedQuote,
          })
          .select('id')
          .single();
        if (error) throw error;
        newId = (data as { id: string }).id;
      } else if (staged.kind === 'area') {
        const { data, error } = await supabase
          .from('areas')
          .insert({
            city_id: cityId,
            name: proposedName,
            quote: proposedQuote,
          })
          .select('id')
          .single();
        if (error) throw error;
        newId = (data as { id: string }).id;
      } else if (staged.kind === 'tip') {
        const tipKind = ((meta.tip_kind as string | undefined) ?? 'atomic') as 'macro' | 'atomic';
        const parentType = tipKind === 'macro' ? 'trip' : 'city';
        const parentId = tipKind === 'macro' ? tripId : cityId;
        const { data, error } = await supabase
          .from('tips')
          .insert({
            parent_type: parentType,
            parent_id: parentId,
            body: proposedName,
            kind: tipKind,
          })
          .select('id')
          .single();
        if (error) throw error;
        newId = (data as { id: string }).id;
      }

      const { error: updateErr } = await supabase
        .from('extracted_entities')
        .update({ confirmed: true, confirmed_entity_id: newId })
        .eq('id', entityId);
      if (updateErr) throw updateErr;
    },
    onSuccess: (_void, vars) => {
      qc.invalidateQueries({ queryKey: tripKeys.extracted(vars.tripId) });
      qc.invalidateQueries({ queryKey: tripKeys.detail(vars.tripId) });
    },
  });
};

export const useRejectEntity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entityId, tripId }: { entityId: string; tripId: string }) => {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('extracted_entities')
        .update({ rejected: true })
        .eq('id', entityId);
      if (error) throw error;
      return { tripId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: tripKeys.extracted(result.tripId) });
    },
  });
};
