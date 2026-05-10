import { getSupabase } from '@/lib/supabase';
import type { Visibility } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../state';
import { authKeys } from './keys';

export type Profile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  default_visibility: Visibility;
  onboarding_completed_at: string | null;
};

export const useProfile = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: userId ? authKeys.profile(userId) : ['auth', 'profile', 'anon'],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      if (!userId) return null;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('users')
        .select('id, handle, display_name, avatar_url, default_visibility, onboarding_completed_at')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
    staleTime: 30_000,
  });
};
