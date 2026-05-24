import { log } from '@/lib/log';
import { hashPhone } from '@/lib/phone-hash';
import { getSupabase } from '@/lib/supabase';
import { PhoneSchema } from '@journal/shared';
import { useMutation } from '@tanstack/react-query';

type Vars = { phone: string };

/**
 * Pilot-grade session start (see docs/decisions/0004-pilot-anonymous-auth.md).
 *
 * Flow:
 *   1. `signInAnonymously()` creates the auth user + public.users row via
 *      the `handle_new_user` trigger.
 *   2. The client hashes the normalized phone with no pepper.
 *   3. The `stamp-phone-hash` edge function applies the server pepper and
 *      writes the peppered hash onto users.phone_hash.
 *
 * Why the round-trip: the pepper lives only in edge-function secrets. The
 * client must not see it. Without this dance, contact matching silently
 * fails (the bug the original implementation shipped with).
 *
 * The phone is *not* an auth credential here — anyone can claim any number.
 * Acceptable for a 20-friend pilot only; OTP comes back before TestFlight.
 */
export const useStartSession = () =>
  useMutation({
    mutationFn: async ({ phone }: Vars) => {
      const normalized = PhoneSchema.parse(phone);
      const clientHashHex = await hashPhone(normalized);
      const supabase = getSupabase();

      // 1. Create the anonymous session.
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error('signInAnonymously returned no user');

      // 2. Stamp the peppered phone_hash via the edge function. The pepper
      //    lives server-side only; the client never sees it.
      const { error: stampErr } = await supabase.functions.invoke('stamp-phone-hash', {
        body: { client_hash: clientHashHex },
      });
      if (stampErr) {
        // Stamping failed → the auth user exists but is unfindable by
        // contact-matching. Roll back the session so the user isn't
        // stranded half-created.
        await supabase.auth.signOut();
        throw new Error(`Phone stamping failed: ${stampErr.message ?? String(stampErr)}`);
      }

      log.event('auth.session_started', { phone_country: normalized.slice(0, 3) });
      return data;
    },
  });
