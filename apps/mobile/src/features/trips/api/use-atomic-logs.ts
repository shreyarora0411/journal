import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * One atomic-log row, with the parent city + country joined for
 * display. RLS filters automatically — the friend-graph variant only
 * returns rows the caller is allowed to see.
 */
export type AtomicLogRow = {
  id: string;
  user_id: string;
  name: string;
  category: 'stay' | 'food' | 'drinks' | 'wander' | 'buy' | 'do' | 'nightlife' | null;
  one_line: string | null;
  prose: string | null;
  visibility: 'followers' | 'friends_of_friends' | 'everyone';
  trip_id: string | null;
  cover_photo_path: string | null;
  google_place_id: string | null;
  created_at: string;
  city: {
    id: string;
    name: string;
    country: { display_name: string; iso_alpha2: string } | null;
  } | null;
  author: {
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null;
};

const SELECT =
  'id, user_id, name, category, one_line, prose, visibility, trip_id, cover_photo_path, google_place_id, created_at, ' +
  'city:city_id(id, name, country:country_id(display_name, iso_alpha2)), ' +
  'author:user_id(id, display_name, handle, avatar_url)';

/** Atomic logs authored by the current user. Reverse chronological. */
export const useMyAtomicLogs = (limit = 30) => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['atomic-logs', 'mine', userId, limit],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AtomicLogRow[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('venues')
        .select(SELECT)
        .eq('user_id', userId)
        .not('category', 'is', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        // 42703 = column doesn't exist (pre-migration-31 install).
        if (error.code === '42703') return [];
        throw error;
      }
      return (data ?? []) as unknown as AtomicLogRow[];
    },
  });
};

/**
 * Atomic logs from the friend graph (RLS handles visibility). Used by
 * the Feed screen. Excludes the caller's own rows — those are surfaced
 * on the profile.
 */
export const useAtomicLogFeed = (limit = 30) => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['atomic-logs', 'feed', userId, limit],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AtomicLogRow[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('venues')
        .select(SELECT)
        .not('category', 'is', null)
        .is('deleted_at', null)
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        if (error.code === '42703') return [];
        throw error;
      }
      return (data ?? []) as unknown as AtomicLogRow[];
    },
  });
};
