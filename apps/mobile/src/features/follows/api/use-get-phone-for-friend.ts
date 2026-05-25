import { getSupabase } from '@/lib/supabase';
import { useMutation } from '@tanstack/react-query';

/**
 * Fetches a friend's plaintext E.164 phone via the
 * `get_phone_for_friend` RPC (migration 16). Returns null when the
 * caller is not in a follow relationship with the target (the SECURITY
 * DEFINER function enforces the check).
 *
 * Used by the Ping CTA on the destination page to deep-link to WhatsApp.
 */
export const useGetPhoneForFriend = () =>
  useMutation({
    mutationFn: async (targetUserId: string): Promise<string | null> => {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('get_phone_for_friend', {
        target_user_id: targetUserId,
      });
      if (error) {
        // Function not found (pre-migration-16 DB) returns null so the
        // Ping flow gracefully degrades into a "phone unavailable" toast.
        if (error.code === 'PGRST202' || error.code === '42883') return null;
        throw error;
      }
      return (data as string | null) ?? null;
    },
  });
