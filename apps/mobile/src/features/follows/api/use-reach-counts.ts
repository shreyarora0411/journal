import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { followKeys } from './keys';

export type ReachCounts = {
  /** People whose map borrows the viewer's — accepted followers only. */
  borrowers: number;
  /** Maps the viewer borrows — accepted follows only. */
  following: number;
};

/**
 * Accepted-only follow counts for the You tab's "Reach" section. Unlike
 * `useFollowCounts` (follows/api/use-follow-status.ts), which counts every
 * row regardless of status, this scopes both sides to
 * `status = 'accepted'` — a pending or blocked row must never read as
 * reach, mirroring the same rule enforced in `useFollowStatus` and
 * `useCircle`.
 */
export const useReachCounts = (userId: string | null | undefined) =>
  useQuery({
    queryKey: userId ? followKeys.reach(userId) : followKeys.reach('null'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ReachCounts> => {
      if (!userId) return { borrowers: 0, following: 0 };
      const supabase = getSupabase();
      const [borrowersRes, followingRes] = await Promise.all([
        supabase
          .from('follows')
          .select('follower_id', { count: 'exact', head: true })
          .eq('followed_id', userId)
          .eq('status', 'accepted'),
        supabase
          .from('follows')
          .select('followed_id', { count: 'exact', head: true })
          .eq('follower_id', userId)
          .eq('status', 'accepted'),
      ]);
      return {
        borrowers: borrowersRes.count ?? 0,
        following: followingRes.count ?? 0,
      };
    },
  });
