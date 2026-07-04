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
  bio: string | null;
  default_visibility: Visibility;
  onboarding_completed_at: string | null;
  home_city: string | null;
  home_lat: number | null;
  home_lng: number | null;
  home_country_code: string | null;
};

// Columns the client cares about; project out of either me() (post mig 10)
// or the legacy select() fallback so the rest of the app doesn't see
// phone_hash by accident.
const pickProfile = (row: Record<string, unknown>): Profile => ({
  id: row.id as string,
  handle: (row.handle as string | null) ?? null,
  display_name: (row.display_name as string | null) ?? null,
  avatar_url: (row.avatar_url as string | null) ?? null,
  bio: (row.bio as string | null) ?? null,
  default_visibility: (row.default_visibility as Visibility) ?? 'friends_of_friends',
  onboarding_completed_at: (row.onboarding_completed_at as string | null) ?? null,
  home_city: (row.home_city as string | null) ?? null,
  home_lat: (row.home_lat as number | null) ?? null,
  home_lng: (row.home_lng as number | null) ?? null,
  home_country_code: (row.home_country_code as string | null) ?? null,
});

// `me()` (migration 10) is preferred — it's a SECURITY DEFINER RPC that
// bypasses the new column-level grant. On Supabase instances where the
// migration hasn't landed yet (PGRST202 = function not found), we fall
// back to the legacy column-selecting query so dev / pre-migration
// pilots don't break. Logs a one-time warning so the gap is obvious.

const FUNCTION_MISSING_CODES = new Set(['PGRST202', '42883']);
let warnedMissingMe = false;

const fetchSelf = async (userId: string): Promise<Profile | null> => {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('me');
  if (!error && data) return pickProfile(data as Record<string, unknown>);

  if (error && !FUNCTION_MISSING_CODES.has(error.code ?? '')) throw error;

  if (!warnedMissingMe) {
    console.warn(
      '[lore] public.me() not found on the database. Apply migration 10 ' +
        '(users_rls_tighten). Falling back to legacy SELECT.',
    );
    warnedMissingMe = true;
  }

  const { data: row, error: legacyErr } = await supabase
    .from('users')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (legacyErr) throw legacyErr;
  if (!row) return null;
  return pickProfile(row as Record<string, unknown>);
};

export { fetchSelf };

export const useProfile = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: userId ? authKeys.profile(userId) : ['auth', 'profile', 'anon'],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      if (!userId) return null;
      return fetchSelf(userId);
    },
    staleTime: 30_000,
  });
};

export const PROFILE_COLUMNS =
  'id, handle, display_name, avatar_url, bio, default_visibility, onboarding_completed_at, home_city, home_lat, home_lng, home_country_code';
