import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export type DiscoverUser = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  bio: string | null;
  /** "via Anushka & Priya" — friend-of-friend attribution. */
  via: string | null;
  trip_count: number;
};

/**
 * Friends-of-friends candidates the viewer doesn't already follow.
 * Per lore brief §10, Tier 2 of the discovery hierarchy.
 */
export const useDiscover = () => {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['discover', viewerId],
    enabled: Boolean(viewerId),
    staleTime: 60_000,
    queryFn: async (): Promise<DiscoverUser[]> => {
      if (!viewerId) return [];
      const supabase = getSupabase();

      const { data: fof, error } = await supabase
        .from('mv_friends_of_friends')
        .select('target_id')
        .eq('viewer_id', viewerId)
        .limit(40);
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      const ids = (fof ?? []).map((r) => (r as { target_id: string }).target_id);
      if (ids.length === 0) return [];

      const [{ data: users }, { data: tripCounts }] = await Promise.all([
        supabase.from('users').select('id, display_name, handle, avatar_url, bio').in('id', ids),
        supabase.from('trips').select('user_id').in('user_id', ids).is('deleted_at', null),
      ]);

      const tripsByUser = new Map<string, number>();
      for (const t of tripCounts ?? []) {
        const uid = (t as { user_id: string }).user_id;
        tripsByUser.set(uid, (tripsByUser.get(uid) ?? 0) + 1);
      }

      // Also resolve the bridge — which of my friends follows each target.
      const { data: myFollows } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', viewerId);
      const myFollowSet = new Set(
        (myFollows ?? []).map((f) => (f as { followed_id: string }).followed_id),
      );
      const { data: bridges } = await supabase
        .from('follows')
        .select('follower_id, followed_id, follower:follower_id(display_name, handle)')
        .in('followed_id', ids);
      type Bridge = {
        follower_id: string;
        followed_id: string;
        follower: { display_name: string | null; handle: string | null } | null;
      };
      const bridgeByTarget = new Map<string, string[]>();
      for (const b of (bridges ?? []) as unknown as Bridge[]) {
        if (!myFollowSet.has(b.follower_id)) continue;
        const name = b.follower?.display_name ?? b.follower?.handle;
        if (!name) continue;
        const arr = bridgeByTarget.get(b.followed_id) ?? [];
        if (!arr.includes(name)) arr.push(name);
        bridgeByTarget.set(b.followed_id, arr);
      }

      type U = {
        id: string;
        display_name: string | null;
        handle: string | null;
        avatar_url: string | null;
        bio: string | null;
      };
      return ((users ?? []) as U[])
        .filter((u) => !myFollowSet.has(u.id))
        .map((u) => {
          const names = bridgeByTarget.get(u.id) ?? [];
          const via =
            names.length === 0
              ? null
              : names.length === 1
                ? `via ${names[0]}`
                : `via ${names[0]} & ${names[1]}${names.length > 2 ? ` +${names.length - 2}` : ''}`;
          return { ...u, via, trip_count: tripsByUser.get(u.id) ?? 0 };
        })
        .sort((a, b) => b.trip_count - a.trip_count);
    },
  });
};
