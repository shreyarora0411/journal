import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * The home "pulse" — three small belonging/utility signals derived from the
 * viewer's circle and their own vouches. No feed, no score: just enough to make
 * the home feel alive between visits and to nudge the viewer toward the city
 * their circle leans on them for (Hennig-Thurau concern-for-others, not points).
 *
 *  - newThisWeek:  count of CIRCLE vouches authored in the last 7 days.
 *  - myVouchCount: how many vouches the viewer has authored (the contribution
 *                  the circle can lean on).
 *  - topCity:      the viewer's single most-frequent destination — powers the
 *                  belonging nudge "your circle leans on you for {topCity}".
 */
export type CirclePulse = {
  newThisWeek: number;
  myVouchCount: number;
  topCity: string | null;
};

const EMPTY: CirclePulse = { newThisWeek: 0, myVouchCount: 0, topCity: null };

// Table-not-found (fresh local DB): tolerate so the home shows zeros instead of
// a thrown query. Mirrors the convention in use-my-vouches / use-vouch-feed.
const isMissingTable = (error: unknown) => (error as { code?: string } | null)?.code === '42P01';

/**
 * Lightweight circle + self stats for the home screen. PULL-based (no push,
 * CLAUDE.md §9/§12). Returns zeros/null when the viewer follows no one or the
 * vouches table isn't deployed yet.
 */
export const useCirclePulse = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['circle-pulse', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<CirclePulse> => {
      if (!userId) return EMPTY;
      const supabase = getSupabase();

      // (1) The viewer's CIRCLE — accepted follows of the viewer. The follows
      // table is world-readable, so circle-scoped counts must filter to this
      // set explicitly. Mirrors use-activity's accepted-follow scoping.
      const followsRes = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', userId)
        .eq('status', 'accepted');
      if (followsRes.error && !isMissingTable(followsRes.error)) throw followsRes.error;
      const circleIds = ((followsRes.data ?? []) as unknown as { followed_id: string }[]).map(
        (r) => r.followed_id,
      );

      // (2) New circle vouches in the last 7 days. If the viewer follows no
      // one, there's nothing to count — skip the query and report 0.
      let newThisWeek = 0;
      if (circleIds.length > 0) {
        const sevenDaysAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const weekRes = await supabase
          .from('vouches')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .in('user_id', circleIds)
          .gte('created_at', sevenDaysAgoISO);
        if (weekRes.error && !isMissingTable(weekRes.error)) throw weekRes.error;
        newThisWeek = weekRes.count ?? 0;
      }

      // (3) The viewer's own vouch count.
      const mineRes = await supabase
        .from('vouches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (mineRes.error && !isMissingTable(mineRes.error)) throw mineRes.error;
      const myVouchCount = mineRes.count ?? 0;

      // (4) topCity — the viewer's most-frequent own destination, tallied
      // client-side from a flat select. Ties resolve to the first seen.
      const destRes = await supabase
        .from('vouches')
        .select('destination_text')
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (destRes.error && !isMissingTable(destRes.error)) throw destRes.error;
      const dests = (destRes.data ?? []) as unknown as { destination_text: string | null }[];
      const tally = new Map<string, number>();
      for (const { destination_text } of dests) {
        if (!destination_text) continue;
        tally.set(destination_text, (tally.get(destination_text) ?? 0) + 1);
      }
      let topCity: string | null = null;
      let topCount = 0;
      for (const [city, count] of tally) {
        if (count > topCount) {
          topCity = city;
          topCount = count;
        }
      }

      return { newThisWeek, myVouchCount, topCity };
    },
  });
};
