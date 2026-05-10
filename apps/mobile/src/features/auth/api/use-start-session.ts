import { log } from '@/lib/log';
import { hashPhone } from '@/lib/phone-hash';
import { getSupabase } from '@/lib/supabase';
import { PhoneSchema } from '@journal/shared';
import { useMutation } from '@tanstack/react-query';

type Vars = { phone: string };

/**
 * Pilot-grade session start (see docs/decisions/0004-pilot-anonymous-auth.md).
 *
 * Calls `signInAnonymously()` to create a session, then stamps
 * `users.phone_hash` on the freshly-created public.users row so the
 * contact-matching flow can find this user by other people's contact lists.
 *
 * The phone is *not* an auth credential here — anyone can claim any number.
 * This is acceptable for a 20-friend pilot only; OTP comes back before TestFlight.
 */
export const useStartSession = () =>
  useMutation({
    mutationFn: async ({ phone }: Vars) => {
      const normalized = PhoneSchema.parse(phone);
      const phoneHashHex = await hashPhone(normalized);
      const supabase = getSupabase();

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error('signInAnonymously returned no user');

      // The handle_new_user trigger creates the public.users row.
      // Stamp phone_hash now (display_name is captured on the framing screen).
      const { error: updateErr } = await supabase
        .from('users')
        .update({ phone_hash: `\\x${phoneHashHex}` })
        .eq('id', user.id);
      if (updateErr) throw updateErr;

      log.event('auth.session_started', { phone_country: normalized.slice(0, 3) });
      return data;
    },
  });
