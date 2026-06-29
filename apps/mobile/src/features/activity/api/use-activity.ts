import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export type ActivityKind = 'trip_added' | 'follow_started' | 'list_created' | 'place_added';

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  user: {
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
  /** Subject the event is about — trip title, target user, list title, place name. */
  subject: string;
  /** Optional snippet — note for a trip, quote for a tip, etc. */
  snippet?: string | null;
  /** Where to route on tap — trip route, friend handle, etc. */
  href: string;
  /** Where this row sits in the chronological grouping. */
  bucket: 'today' | 'yesterday' | 'this_week' | 'earlier';
  created_at: string;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const bucketFor = (iso: string): ActivityEvent['bucket'] => {
  const ts = new Date(iso).getTime();
  const today = startOfDay(new Date()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekStart = today - 6 * 24 * 60 * 60 * 1000;
  if (ts >= today) return 'today';
  if (ts >= yesterday) return 'yesterday';
  if (ts >= weekStart) return 'this_week';
  return 'earlier';
};

/**
 * Friends-tab activity stream. Pilot v0 derives events from the existing
 * tables — trips, follows, lists — rather than the activity table (which
 * is empty until we wire writes everywhere). Aggregated client-side.
 */
export const useActivity = () => {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: ['activity', viewerId],
    enabled: Boolean(viewerId),
    staleTime: 30_000,
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!viewerId) return [];
      const supabase = getSupabase();

      // The viewer's CIRCLE — accepted follows of the viewer. The follows
      // table is world-readable (no circle RLS gate), so any event we derive
      // from it must be filtered to this set client-side; otherwise strangers'
      // follow events leak into the feed, breaking the "no strangers" promise.
      // Mirrors the accepted-follow scoping the rest of the app uses.
      const circleRes = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', viewerId)
        .eq('status', 'accepted');
      if (circleRes.error) throw circleRes.error;
      const circleIds = new Set(
        ((circleRes.data ?? []) as unknown as { followed_id: string }[]).map((r) => r.followed_id),
      );
      // The viewer is always in their own circle.
      circleIds.add(viewerId);

      // Recent friend trips (RLS-filtered).
      const tripsRes = await supabase
        .from('trips')
        .select(
          'id, title, note, created_at, user_id, author:user_id(id, display_name, handle, avatar_url)',
        )
        .is('deleted_at', null)
        .neq('user_id', viewerId)
        .order('created_at', { ascending: false })
        .limit(40);
      if (tripsRes.error) throw tripsRes.error;

      // Recent follow events — but ONLY where the follower is in the viewer's
      // circle. The follows table is world-readable, so without this gate the
      // feed would surface arbitrary strangers' follow events. We scope the
      // query to circle followers (the row author is `follower`, line below)
      // and defensively re-filter the result against `circleIds`.
      const circleActorIds = [...circleIds].filter((id) => id !== viewerId);
      const followsRes = circleActorIds.length
        ? await supabase
            .from('follows')
            .select(
              'created_at, follower_id, followed_id, follower:follower_id(id, display_name, handle, avatar_url), followed:followed_id(id, display_name, handle)',
            )
            .in('follower_id', circleActorIds)
            .order('created_at', { ascending: false })
            .limit(20)
        : { data: [], error: null };

      // Lists table only exists after migration 0005 — tolerate the 42P01 error
      // ("relation does not exist") so the screen works mid-rollout.
      const listsRes = await supabase
        .from('lists')
        .select(
          'id, title, description, created_at, owner_id, author:owner_id(id, display_name, handle, avatar_url)',
        )
        .is('deleted_at', null)
        .neq('owner_id', viewerId)
        .order('created_at', { ascending: false })
        .limit(20);

      const events: ActivityEvent[] = [];

      type TripRow = {
        id: string;
        title: string;
        note: string | null;
        created_at: string;
        user_id: string;
        author: ActivityEvent['user'] | null;
      };
      for (const t of (tripsRes.data ?? []) as unknown as TripRow[]) {
        if (!t.author) continue;
        events.push({
          id: `trip-${t.id}`,
          kind: 'trip_added',
          user: t.author,
          subject: t.title,
          snippet: t.note ? t.note.slice(0, 140) : null,
          href: `/trip/${t.id}`,
          bucket: bucketFor(t.created_at),
          created_at: t.created_at,
        });
      }

      type FollowRow = {
        created_at: string;
        follower_id: string;
        follower: ActivityEvent['user'] | null;
        followed: { id: string; display_name: string | null; handle: string | null } | null;
      };
      for (const f of (followsRes.data ?? []) as unknown as FollowRow[]) {
        if (!f.follower || !f.followed) continue;
        // Circle gate: only follow events authored by someone in the viewer's
        // accepted circle. Defends against any world-readable rows that slip
        // past the query-level `.in(...)` filter (e.g. stale cache).
        if (!circleIds.has(f.follower_id)) continue;
        events.push({
          id: `follow-${f.follower.id}-${f.followed.id}-${f.created_at}`,
          kind: 'follow_started',
          user: f.follower,
          subject: f.followed.display_name ?? f.followed.handle ?? 'someone',
          snippet: null,
          href: f.followed.handle ? `/friend/${f.followed.handle}` : '/',
          bucket: bucketFor(f.created_at),
          created_at: f.created_at,
        });
      }

      type ListRow = {
        id: string;
        title: string;
        description: string | null;
        created_at: string;
        author: ActivityEvent['user'] | null;
      };
      // Ignore listsRes errors; pre-migration, the table doesn't exist.
      if (!listsRes.error) {
        for (const l of (listsRes.data ?? []) as unknown as ListRow[]) {
          if (!l.author) continue;
          events.push({
            id: `list-${l.id}`,
            kind: 'list_created',
            user: l.author,
            subject: l.title,
            snippet: l.description,
            href: `/list/${l.id}`,
            bucket: bucketFor(l.created_at),
            created_at: l.created_at,
          });
        }
      }

      return events.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
    },
  });
};
