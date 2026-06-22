import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * The set of vouch ids the current user has saved (across all their plans),
 * so search cards can render a filled "saved" state. One small query keyed
 * to the user; invalidated on save.
 */
export const useSavedVouchIds = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['saved-vouch-ids', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Set<string>> => {
      if (!userId) return new Set();
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('saved_vouches')
        .select('vouch_id')
        .eq('saved_by_user_id', userId);
      if (error) {
        if ((error as { code?: string }).code === '42P01') return new Set(); // table missing
        throw error;
      }
      return new Set((data ?? []).map((r) => (r as { vouch_id: string }).vouch_id));
    },
  });
};

type SaveVars = { vouchId: string; destinationText: string };

/**
 * Save a vouch to the user's plan for that destination. v0 keeps it one-tap:
 * a single plan per destination, found-or-created on first save. The
 * saved_vouches unique(plan_id, vouch_id) makes re-saving a no-op.
 */
export const useSaveVouch = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async ({ vouchId, destinationText }: SaveVars): Promise<{ saved: true }> => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();

      // Find-or-create the plan for this destination.
      const { data: existing, error: findErr } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', userId)
        .eq('destination_text', destinationText)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;

      let planId = (existing as { id: string } | null)?.id ?? null;
      if (!planId) {
        const { data: created, error: createErr } = await supabase
          .from('plans')
          .insert({ user_id: userId, destination_text: destinationText, title: destinationText })
          .select('id')
          .single();
        if (createErr) throw createErr;
        planId = (created as { id: string }).id;
      }

      const { error: saveErr } = await supabase
        .from('saved_vouches')
        .upsert(
          { plan_id: planId, vouch_id: vouchId, saved_by_user_id: userId },
          { onConflict: 'plan_id,vouch_id', ignoreDuplicates: true },
        );
      if (saveErr) throw saveErr;

      log.event('vouch.saved', { destination_country: destinationText.slice(0, 0) });
      return { saved: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-vouch-ids', userId] });
      qc.invalidateQueries({ queryKey: ['plans', userId] });
    },
  });
};
