import { useAuthStore } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

const MISSING = new Set(['42P01', '42883', 'PGRST202']);
const isMissing = (e: { code?: string } | null) => MISSING.has(e?.code ?? '');

export type PersonLovedPlace = {
  place_id: string;
  name: string;
  hub: string | null;
  zone: string | null;
  category: string | null;
  google_place_id: string;
  lat: number | null;
  lng: number | null;
  note: string | null;
};

export type PersonMap = {
  person: {
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null;
  match: number | null;
  places: PersonLovedPlace[];
};

/**
 * A person AS a map — their identity row, the viewer's taste-overlap with
 * them, and their loved places (attributed by design; notes visibility-gated;
 * fine/skip never appear). This is the structural anti-dating affordance: a
 * person here is a collection of places you can act on, not a profile.
 */
export const usePersonMap = (userId: string | null) => {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    // viewerId is in the key: match + visibility-gated notes are viewer-
    // relative and must not survive an account switch.
    queryKey: ['taste', 'person', viewerId, userId],
    enabled: Boolean(viewerId) && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<PersonMap> => {
      const supabase = getSupabase();
      const [personRes, placesRes, matchRes] = await Promise.all([
        // No deleted_at filter: it isn't in the column grant (mig 61) and
        // the users_safe_cols_read policy already hides deleted rows.
        supabase
          .from('users')
          .select('id, display_name, handle, avatar_url')
          .eq('id', userId as string)
          .maybeSingle(),
        supabase.rpc('user_loved_places', { p_user: userId }),
        userId === viewerId
          ? Promise.resolve({ data: null, error: null })
          : supabase.rpc('taste_match', { p_other: userId }),
      ]);
      if (personRes.error && !isMissing(personRes.error)) throw personRes.error;
      if (placesRes.error && !isMissing(placesRes.error)) throw placesRes.error;
      // taste_match failure is non-fatal — the map is the point.
      return {
        person: personRes.data ?? null,
        match: (matchRes.data as number | null) ?? null,
        places: ((placesRes.data ?? []) as PersonLovedPlace[]) ?? [],
      };
    },
  });
};
