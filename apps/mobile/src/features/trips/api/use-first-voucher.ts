import { getSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * One row from `get_first_voucher_for_place` (migration 36).
 *
 * `months_gap` is the distance to the SECOND voucher in the viewer's
 * network. Null when there's only one voucher (no comparison possible).
 * The caller decides whether the gap is meaningful enough to render
 * the badge — spec says >= 3 months.
 */
export type FirstVoucher = {
  voucher_user_id: string;
  voucher_display_name: string;
  voucher_trip_id: string;
  voucher_created_at: string;
  months_gap: number | null;
};

/**
 * Returns the first person in the viewer's network to vouch for a
 * given destination (keyed by city.google_place_id). Returns null when
 * no one in the network has been there — or, more commonly, when the
 * destination wasn't actually picked via the Google Place picker so
 * we don't have a stable place handle to query against.
 */
export const useFirstVoucherForPlace = (googlePlaceId: string | null | undefined) =>
  useQuery({
    queryKey: ['first-voucher', googlePlaceId],
    enabled: Boolean(googlePlaceId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<FirstVoucher | null> => {
      if (!googlePlaceId) return null;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .rpc('get_first_voucher_for_place', { p_google_place_id: googlePlaceId })
        .maybeSingle();
      if (error) {
        // 42883 = function does not exist; common until migration 36
        // is applied to the user's Supabase project. Fail silently —
        // the badge just won't show.
        if ((error as { code?: string }).code === '42883') return null;
        throw error;
      }
      return (data ?? null) as FirstVoucher | null;
    },
  });
