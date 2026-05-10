import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

type MatchedFriend = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
};

export const useMatchedFriends = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['onboarding', 'matched-friends', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MatchedFriend[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('contact_matches')
        .select('matched_user_id, users:matched_user_id (id, display_name, handle, avatar_url)')
        .eq('user_id', userId);
      if (error) throw error;
      type Row = { users: MatchedFriend | null };
      return (data as unknown as Row[])
        .map((r) => r.users)
        .filter((u): u is MatchedFriend => Boolean(u));
    },
  });
};
