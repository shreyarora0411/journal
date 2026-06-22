import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import type { VouchType } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';

/** A circle vouch for the feed, joined with its author + source trip. */
export type FeedVouch = {
  id: string;
  text: string;
  vouch_type: VouchType;
  destination_text: string;
  created_at: string;
  trip_id: string;
  author: {
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null;
  trip: { title: string; verdict: 'love' | 'mid' | 'skip' | null } | null;
};

const SELECT =
  'id, text, vouch_type, destination_text, created_at, trip_id, ' +
  'author:user_id(id, display_name, handle, avatar_url), ' +
  'trip:trip_id(title, verdict)';

/**
 * Recent vouches from the user's circle for the Book/home feed.
 *
 * RLS (vouches_circle_read) bounds visibility to accepted-circle authors;
 * we additionally exclude the caller's own vouches — own work lives on the
 * profile, the feed is "your circle" (matches the existing feed convention).
 * Reverse-chronological.
 */
export const useVouchFeed = (limit = 40) => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['vouches', 'feed', userId, limit],
    enabled: Boolean(userId),
    queryFn: async (): Promise<FeedVouch[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('vouches')
        .select(SELECT)
        .is('deleted_at', null)
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        if ((error as { code?: string }).code === '42P01') return []; // table missing
        throw error;
      }
      return (data ?? []) as unknown as FeedVouch[];
    },
  });
};
