import { getSupabase } from '@/lib/supabase';
import { type ProfileUpdate, ProfileUpdateSchema } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../state';
import { authKeys } from './keys';
import { type Profile, fetchSelf } from './use-profile';

type Vars = ProfileUpdate & { onboarding_completed?: boolean };

/**
 * Owner-only profile update.
 *
 * Migration 10 column-level-restricts `SELECT` on `public.users`, so
 * `.update().select(*)` would silently fail for restricted columns. We
 * update without RETURNING, then refetch via `fetchSelf` — which prefers
 * the `me()` RPC (migration 10) and falls back to the legacy column
 * select on instances where the migration hasn't landed yet.
 */
export const useUpdateProfile = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (vars: Vars): Promise<Profile> => {
      if (!userId) throw new Error('Not signed in');
      const validated = ProfileUpdateSchema.parse({
        display_name: vars.display_name,
        avatar_url: vars.avatar_url,
        default_visibility: vars.default_visibility,
        home_city: vars.home_city,
        home_lat: vars.home_lat,
        home_lng: vars.home_lng,
        home_country_code: vars.home_country_code,
      });

      const update: Record<string, unknown> = { ...validated };
      if (vars.onboarding_completed) update.onboarding_completed_at = new Date().toISOString();

      const supabase = getSupabase();
      const { error: updateErr } = await supabase.from('users').update(update).eq('id', userId);
      if (updateErr) throw updateErr;

      const next = await fetchSelf(userId);
      if (!next) throw new Error('Could not re-read profile after update');
      return next;
    },
    onSuccess: (profile) => {
      if (userId) qc.setQueryData(authKeys.profile(userId), profile);
    },
  });
};
