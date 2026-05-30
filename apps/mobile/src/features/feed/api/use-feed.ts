import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import type { Trip } from '@journal/shared';
import { useInfiniteQuery } from '@tanstack/react-query';

export type FeedRow = Trip & {
  author: {
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null;
  cover_photo_path: string | null;
  /** Public love count (migration 13). 0 when nothing rendered yet. */
  love_count: number;
};

const PAGE_SIZE = 10;

/**
 * Reverse-chronological feed of trips visible to the current user.
 *
 * RLS handles visibility — the SELECT returns the union of:
 *   - your own trips
 *   - trips with visibility=followers from users you follow
 *   - trips with visibility=friends_of_friends from your follow-of-follow set
 *   - trips with visibility=everyone from any user
 *
 * Cursor is the `created_at` of the last row of the previous page.
 */
export const useFeed = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useInfiniteQuery({
    queryKey: ['feed', userId],
    enabled: Boolean(userId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<{ rows: FeedRow[]; nextCursor: string | null }> => {
      const supabase = getSupabase();
      // Read from the view that pre-aggregates love_count per trip
      // (migration 13). RLS on the underlying trips table still applies
      // because the view is SECURITY INVOKER.
      // Query `public.trips` directly rather than the
      // `trip_with_verdict_counts` view. PostgREST can't reliably infer
      // the FK embeds (author:user_id, cover:cover_photo_id) through a
      // view that re-projects `t.*` — the embed planner only sees the
      // view's columns, not the underlying FK constraints, and returns
      // a 400 (PGRST200). love_count is intentionally 0 here; verdict
      // aggregation will be re-introduced via a separate batched RPC.
      let q = supabase
        .from('trips')
        .select(
          'id, user_id, title, start_date, end_date, note, cover_photo_id, visibility, imported_from, created_at, updated_at, deleted_at, author:user_id(id, display_name, handle, avatar_url), cover:cover_photo_id(storage_path)',
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) q = q.lt('created_at', pageParam);

      const { data, error } = await q;
      if (error) throw error;

      type Raw = Trip & {
        author: FeedRow['author'];
        cover: { storage_path: string } | null;
      };
      const raw = (data ?? []) as unknown as Raw[];
      const rows: FeedRow[] = raw.map((r) => ({
        ...r,
        author: r.author,
        cover_photo_path: r.cover?.storage_path ?? null,
        love_count: 0,
      }));
      const last = rows[rows.length - 1];
      const nextCursor = rows.length === PAGE_SIZE && last ? last.created_at : null;
      return { rows, nextCursor };
    },
    getNextPageParam: (last) => last.nextCursor,
  });
};
