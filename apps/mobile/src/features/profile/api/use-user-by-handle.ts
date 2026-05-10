import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export type PublicUser = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export const useUserByHandle = (handle: string | null | undefined) =>
  useQuery({
    queryKey: ['profile', 'by-handle', handle],
    enabled: Boolean(handle),
    queryFn: async (): Promise<PublicUser | null> => {
      if (!handle) return null;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('users')
        .select('id, handle, display_name, avatar_url')
        .eq('handle', handle)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return (data as PublicUser | null) ?? null;
    },
  });
