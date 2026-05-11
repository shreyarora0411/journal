import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export type MatchedFriend = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  /** Smart-pick badge text — "3 friends in common", "Just back from Lisbon", "Travels often". */
  badge: string | null;
  /** Rank score — higher is better. */
  score: number;
};

/**
 * Smart contact picks for onboarding (Postmark brief screen 06).
 *
 * Pulls hashed contact matches, joins to profile data, then enriches with:
 *   - `mutuals`: number of friends already common with the viewer (FoF tier)
 *   - `recent_trip_title`: their most recent trip title if visible
 *   - `trip_count`: how many trips they've logged
 *
 * Ranks by mutuals desc, then trip_count desc, then alphabetical.
 */
export const useMatchedFriends = () => {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['onboarding', 'matched-friends', 'ranked', viewerId],
    enabled: Boolean(viewerId),
    queryFn: async (): Promise<MatchedFriend[]> => {
      if (!viewerId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('contact_matches')
        .select('matched_user_id, users:matched_user_id (id, display_name, handle, avatar_url)')
        .eq('user_id', viewerId);
      if (error) throw error;
      type Row = { matched_user_id: string; users: Omit<MatchedFriend, 'badge' | 'score'> | null };
      const matches = (data as unknown as Row[])
        .map((r) => r.users)
        .filter((u): u is Omit<MatchedFriend, 'badge' | 'score'> => Boolean(u));
      if (matches.length === 0) return [];

      // Trip counts + last trip title per matched user (RLS-filtered).
      const ids = matches.map((m) => m.id);
      const { data: trips } = await supabase
        .from('trips')
        .select('user_id, title, created_at')
        .in('user_id', ids)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      const tripCount = new Map<string, number>();
      const lastTrip = new Map<string, string>();
      for (const t of trips ?? []) {
        const uid = t.user_id as string;
        tripCount.set(uid, (tripCount.get(uid) ?? 0) + 1);
        if (!lastTrip.has(uid)) lastTrip.set(uid, t.title as string);
      }

      // Mutual-friend count via the FoF materialised view.
      const { data: fof } = await supabase
        .from('mv_friends_of_friends')
        .select('target_id')
        .eq('viewer_id', viewerId)
        .in('target_id', ids);
      const fofSet = new Set((fof ?? []).map((r) => (r as { target_id: string }).target_id));

      const ranked = matches.map((m): MatchedFriend => {
        const trips = tripCount.get(m.id) ?? 0;
        const isMutual = fofSet.has(m.id);
        let badge: string | null = null;
        if (isMutual) badge = 'Friends in common';
        else if (lastTrip.has(m.id)) badge = `Just back from ${lastTrip.get(m.id)}`;
        else if (trips >= 5) badge = 'Travels often';
        else if (trips > 0) badge = `${trips} trip${trips === 1 ? '' : 's'}`;
        else badge = 'New on Postmark';
        const score = (isMutual ? 100 : 0) + trips * 5;
        return { ...m, badge, score };
      });

      ranked.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.display_name ?? a.handle ?? '').localeCompare(b.display_name ?? b.handle ?? '');
      });
      return ranked;
    },
  });
};
