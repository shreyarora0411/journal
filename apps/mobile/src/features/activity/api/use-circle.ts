import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { type TrustProfile, deriveTrustProfile } from '@/lib/trust-context';
import type { VouchType } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';

/**
 * One person in the viewer's circle, with what they're trusted FOR. Drives the
 * Friends trust DIRECTORY (not an activity feed): the people you actually text
 * for recs, each tagged by domain. `trust` is null when they've authored no
 * vouches yet — the row still shows so you can see who's in but quiet.
 */
export type CircleMember = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  trust: TrustProfile | null;
};

// Table-not-found (fresh local DB): tolerate so the directory renders empty
// instead of throwing. Mirrors use-circle-pulse / use-my-vouches.
const isMissingTable = (error: unknown) => (error as { code?: string } | null)?.code === '42P01';

/**
 * The viewer's circle as a trust directory, ordered by usefulness (most vouches
 * first; never recency or popularity). Accepted follows only — the follows
 * table is world-readable, so the circle is scoped to `status = 'accepted'`,
 * mirroring use-activity / use-circle-pulse. Circle vouches are readable via
 * the `vouches_circle_read` RLS policy (migration 38).
 */
export const useCircle = () => {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: ['circle', viewerId],
    enabled: Boolean(viewerId),
    staleTime: 30_000,
    queryFn: async (): Promise<CircleMember[]> => {
      if (!viewerId) return [];
      const supabase = getSupabase();

      // (1) Accepted follows → the people in the circle, with their identity.
      const followsRes = await supabase
        .from('follows')
        .select('followed:followed_id(id, display_name, handle, avatar_url)')
        .eq('follower_id', viewerId)
        .eq('status', 'accepted');
      if (followsRes.error && !isMissingTable(followsRes.error)) throw followsRes.error;

      type FollowRow = {
        followed: {
          id: string;
          display_name: string | null;
          handle: string | null;
          avatar_url: string | null;
        } | null;
      };
      const members = ((followsRes.data ?? []) as unknown as FollowRow[])
        .map((r) => r.followed)
        .filter((m): m is NonNullable<FollowRow['followed']> => m != null);
      if (members.length === 0) return [];

      // (2) Their vouches — type + destination only, enough to derive what each
      // is trusted for. One flat select over the whole circle, tallied client-
      // side (no per-person round-trips).
      const ids = members.map((m) => m.id);
      const vouchRes = await supabase
        .from('vouches')
        .select('user_id, vouch_type, destination_text')
        .in('user_id', ids)
        .is('deleted_at', null);
      if (vouchRes.error && !isMissingTable(vouchRes.error)) throw vouchRes.error;

      type VouchRow = { user_id: string; vouch_type: VouchType; destination_text: string | null };
      const byUser = new Map<
        string,
        { vouch_type: VouchType; destination_text: string | null }[]
      >();
      for (const v of (vouchRes.data ?? []) as unknown as VouchRow[]) {
        const arr = byUser.get(v.user_id);
        const entry = { vouch_type: v.vouch_type, destination_text: v.destination_text };
        if (arr) arr.push(entry);
        else byUser.set(v.user_id, [entry]);
      }

      const out: CircleMember[] = members.map((m) => ({
        id: m.id,
        display_name: m.display_name,
        handle: m.handle,
        avatar_url: m.avatar_url,
        trust: deriveTrustProfile(byUser.get(m.id) ?? []),
      }));

      // Order by usefulness: most vouches first; people with none sink to the
      // bottom, alphabetised so the list is stable (never recency/popularity).
      out.sort((a, b) => {
        const av = a.trust?.vouchCount ?? 0;
        const bv = b.trust?.vouchCount ?? 0;
        if (bv !== av) return bv - av;
        return (a.display_name ?? a.handle ?? '').localeCompare(b.display_name ?? b.handle ?? '');
      });
      return out;
    },
  });
};
