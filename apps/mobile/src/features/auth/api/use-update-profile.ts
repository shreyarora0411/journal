import { getSupabase } from '@/lib/supabase';
import { type ProfileUpdate, ProfileUpdateSchema } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../state';
import { authKeys } from './keys';
import type { Profile } from './use-profile';

type Vars = ProfileUpdate & { onboarding_completed?: boolean };

/**
 * Owner-only profile update.
 *
 * Migration 10 column-level-restricts `SELECT` on `public.users` to a
 * narrow safe set, so `.update().select(*)` would silently fail for
 * columns like `home_city` and `onboarding_completed_at`. We update
 * without a `RETURNING`, then refetch the full row via the `me()` RPC
 * (SECURITY DEFINER, bypasses the column grant).
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

      // Re-fetch the full owner row via the SECURITY DEFINER `me()` RPC
      // because authenticated users no longer have SELECT privilege on
      // the restricted columns (default_visibility, home_*, etc.).
      const { data, error: readErr } = await supabase.rpc('me');
      if (readErr) throw readErr;
      const row = data as (Profile & Record<string, unknown>) | null;
      if (!row) throw new Error('me() returned no row after profile update');
      return {
        id: row.id,
        handle: row.handle,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        default_visibility: row.default_visibility,
        onboarding_completed_at: row.onboarding_completed_at,
        home_city: row.home_city,
        home_lat: row.home_lat,
        home_lng: row.home_lng,
        home_country_code: row.home_country_code,
      };
    },
    onSuccess: (profile) => {
      if (userId) qc.setQueryData(authKeys.profile(userId), profile);
    },
  });
};
