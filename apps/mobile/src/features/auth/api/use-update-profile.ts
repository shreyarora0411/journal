import { getSupabase } from '@/lib/supabase';
import { type ProfileUpdate, ProfileUpdateSchema } from '@journal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../state';
import { authKeys } from './keys';
import type { Profile } from './use-profile';

type Vars = ProfileUpdate & { onboarding_completed?: boolean; phone_hash_hex?: string };

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
      });

      const update: Record<string, unknown> = { ...validated };
      if (vars.onboarding_completed) update.onboarding_completed_at = new Date().toISOString();
      if (vars.phone_hash_hex) update.phone_hash = `\\x${vars.phone_hash_hex}`;

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('users')
        .update(update)
        .eq('id', userId)
        .select('id, handle, display_name, avatar_url, default_visibility, onboarding_completed_at')
        .single();

      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (profile) => {
      if (userId) qc.setQueryData(authKeys.profile(userId), profile);
    },
  });
};
