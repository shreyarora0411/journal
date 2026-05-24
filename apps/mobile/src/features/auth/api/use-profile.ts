import { getSupabase } from '@/lib/supabase';
import type { Visibility } from '@journal/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../state';
import { authKeys } from './keys';

export type Profile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  default_visibility: Visibility;
  onboarding_completed_at: string | null;
  home_city: string | null;
  home_lat: number | null;
  home_lng: number | null;
  home_country_code: string | null;
};

/**
 * Self-profile read. Migration 10 column-level-restricts SELECT on
 * `public.users` for `authenticated` — only the safe public columns are
 * grantable. We use the `public.me()` SECURITY DEFINER RPC for owner
 * self-reads so we can still pull the full row (phone_hash redaction
 * happens in the response shape below — we never expose it client-side).
 */
export const useProfile = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: userId ? authKeys.profile(userId) : ['auth', 'profile', 'anon'],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      if (!userId) return null;
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('me');
      if (error) throw error;
      if (!data) return null;
      // `me()` returns the full row. Project only the fields the client
      // app expects so we don't accidentally render phone_hash anywhere.
      const row = data as Profile & { phone_hash?: unknown };
      return {
        id: row.id,
        handle: row.handle,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        default_visibility: row.default_visibility,
        onboarding_completed_at: row.onboarding_completed_at,
        home_city: row.home_city,
        home_lat: row.home_lat,
        home_lng: row.home_lng,
        home_country_code: row.home_country_code,
      };
    },
    staleTime: 30_000,
  });
};

// Kept for callers that still construct ad-hoc selects against `users`.
// New code should prefer the me() RPC for self-reads and `public_profiles`
// for cross-user reads.
export const PROFILE_COLUMNS =
  'id, handle, display_name, avatar_url, default_visibility, onboarding_completed_at, home_city, home_lat, home_lng, home_country_code';
