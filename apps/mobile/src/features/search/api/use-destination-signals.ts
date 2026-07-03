import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Punctuation-insensitive destination key, matching the DB's norm_search
// (migration 46): lowercase, fold every non-alphanumeric run to a single space,
// trim. Computed client-side so the upsert's conflict key is self-consistent and
// we don't depend on a server function being in PostgREST's schema cache.
const normDestination = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Capture the destination the viewer is SEARCHING — the honest, in-app,
 * revealed travel-CONSIDERATION signal (Gollwitzer: behaviour > stated intent).
 * Viewer-PRIVATE (destination_signals own-row RLS, migration 54). We never
 * fabricate "going in March" and never broadcast this to the circle; it only
 * powers first-person resurfacing ("the place you were looking at").
 *
 * Writes via a direct table UPSERT (not the migration-54 RPC) so it depends only
 * on the table being present — robust to PostgREST function-cache lag. On
 * conflict it just bumps last_searched_at; the exact search_count isn't needed
 * for resurfacing (latest-by-time wins). Fire-and-forget: rides alongside the
 * user's search, so it must NEVER block or surface an error; no-ops cleanly when
 * the table isn't deployed yet.
 */
export const useRecordDestinationSearch = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async (destination: string): Promise<void> => {
      const d = destination.trim();
      const norm = normDestination(d);
      if (!userId || norm.length < 2) return;
      const { error } = await getSupabase().from('destination_signals').upsert(
        {
          user_id: userId,
          destination_text: d,
          norm_destination: norm,
          last_searched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,norm_destination' },
      );
      if (error) {
        if ((error as { code?: string }).code === '42P01') return; // table not deployed yet
        throw error;
      }
    },
    // Best-effort, non-critical telemetry: a missed capture just means one
    // fewer resurfacing hint. Warn (not error) so a transient network blip
    // doesn't read as a real failure or surface a red dev toast.
    onError: (err) => log.warn('record destination search skipped', { error: String(err) }),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ['destination-signal', 'latest', userId] });
    },
  });
};

export type DestinationSignal = {
  destination_text: string;
  norm_destination: string;
  search_count: number;
  last_searched_at: string;
};

/**
 * The most recent destination the viewer searched — their own private "you were
 * looking at {dest}" signal. Drives honest resurfacing on the home/feed instead
 * of the old heuristic that relabelled the first wishlist row an "upcoming trip".
 * Returns null when nothing's been searched or migration 54 isn't deployed.
 */
export const useLatestDestinationSignal = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['destination-signal', 'latest', userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<DestinationSignal | null> => {
      if (!userId) return null;
      const { data, error } = await getSupabase()
        .from('destination_signals')
        .select('destination_text, norm_destination, search_count, last_searched_at')
        .eq('user_id', userId)
        .order('last_searched_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        if ((error as { code?: string }).code === '42P01') return null; // table not deployed yet
        throw error;
      }
      return (data as DestinationSignal | null) ?? null;
    },
  });
};
