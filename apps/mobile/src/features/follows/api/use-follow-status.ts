import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { followKeys } from './keys';

/** Whether the current user follows `followedId`. */
export const useFollowStatus = (followedId: string | null | undefined) => {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: followedId ? followKeys.status(followedId) : followKeys.status('null'),
    enabled: Boolean(viewerId && followedId && viewerId !== followedId),
    queryFn: async (): Promise<boolean> => {
      if (!viewerId || !followedId) return false;
      const supabase = getSupabase();
      // accepted only: a pending or blocked row must not read as "following"
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', viewerId)
        .eq('followed_id', followedId)
        .eq('status', 'accepted')
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });
};

export const useFollowCounts = (userId: string | null | undefined) =>
  useQuery({
    queryKey: userId ? followKeys.counts(userId) : followKeys.counts('null'),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return { followers: 0, following: 0 };
      const supabase = getSupabase();
      const [followersRes, followingRes] = await Promise.all([
        supabase
          .from('follows')
          .select('follower_id', { count: 'exact', head: true })
          .eq('followed_id', userId),
        supabase
          .from('follows')
          .select('followed_id', { count: 'exact', head: true })
          .eq('follower_id', userId),
      ]);
      return {
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      };
    },
  });
