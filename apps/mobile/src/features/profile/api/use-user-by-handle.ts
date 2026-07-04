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
      // No deleted_at filter: not in the mig-61 column grant, and the
      // users_safe_cols_read policy already hides deleted rows.
      const { data, error } = await supabase
        .from('users')
        .select('id, handle, display_name, avatar_url')
        .eq('handle', handle)
        .maybeSingle();
      if (error) throw error;
      return (data as PublicUser | null) ?? null;
    },
  });
