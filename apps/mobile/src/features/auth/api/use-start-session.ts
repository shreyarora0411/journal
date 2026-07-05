import { applyPendingFollow } from '@/features/invite';
import { log } from '@/lib/log';
import { hashPhone } from '@/lib/phone-hash';
import { getSupabase } from '@/lib/supabase';
import { PhoneSchema } from '@journal/shared';
import { useMutation } from '@tanstack/react-query';

type Vars = { phone: string };

/** Thrown when the phone is a known account — recovery is human-mediated
 *  for now (see recover-session's 2026-07-05 security note), not a normal
 *  network failure. login-screen.tsx matches on this to show the right copy
 *  instead of a generic "try again". */
export class KnownPhoneNoRecoveryError extends Error {
  constructor() {
    super(
      'This number already has a Vouch account. Ask whoever invited you to help you get back in — self-serve recovery is coming soon.',
    );
    this.name = 'KnownPhoneNoRecoveryError';
  }
}

/**
 * Pilot-grade session start with phone-number recovery.
 *
 * Two paths:
 *
 *   A. Returning user — the entered phone has been seen before.
 *      `recover-session` answers {found: true} but issues no token (see
 *      its 2026-07-05 security note — there is no OTP delivery channel
 *      wired yet, so a known phone cannot be self-serve recovered). We
 *      throw KnownPhoneNoRecoveryError rather than silently minting a
 *      second account for a phone that already has one — that would
 *      corrupt contact-matching and orphan the existing circle/vouches.
 *
 *   B. New user — no phone-hash match. We fall back to the original
 *      flow: signInAnonymously() → stamp-phone-hash (which also stamps
 *      a synthetic email on auth.users so this user is recoverable
 *      once real OTP delivery exists).
 *
 * The pepper stays server-side; the client only ever sends the
 * unpeppered SHA-256 of the normalized phone. This matches the
 * security posture of match-contacts.
 *
 * See docs/decisions/0004-pilot-anonymous-auth.md (note: this hook
 * extends that decision with phone-keyed recovery — update the ADR
 * the next time it's revised).
 */
export const useStartSession = () =>
  useMutation({
    mutationFn: async ({ phone }: Vars) => {
      const normalized = PhoneSchema.parse(phone);
      const clientHashHex = await hashPhone(normalized);
      const supabase = getSupabase();

      // ---- Path A: is this phone a known, existing account? -------------
      try {
        const { data: recoverData, error: recoverErr } = await supabase.functions.invoke<{
          found: boolean;
        }>('recover-session', { body: { client_hash: clientHashHex } });

        if (!recoverErr && recoverData?.found) {
          // Known phone, no redeemable token issued (by design — see the
          // function's security note). Refuse to mint a duplicate account.
          log.warn('recover-session: known phone, no self-serve recovery available yet');
          throw new KnownPhoneNoRecoveryError();
        }
      } catch (err) {
        if (err instanceof KnownPhoneNoRecoveryError) throw err;
        // Otherwise: edge function not deployed, network glitch, etc.,
        // for a phone that was NOT recognized. Fall through to the
        // new-user signup path — recovery is a best-effort optimization
        // for new phones, not a hard dependency.
        log.warn('recover-session threw; falling through to new signup', {
          error: String(err),
        });
      }

      // ---- Path B: brand-new user ---------------------------------------
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error('signInAnonymously returned no user');

      const { error: stampErr } = await supabase.functions.invoke('stamp-phone-hash', {
        body: { client_hash: clientHashHex, phone_e164: normalized },
      });
      if (stampErr) {
        // Stamp failed → the auth user exists but isn't findable by
        // contact-matching OR recoverable. Roll back the session so
        // the user isn't stranded half-created.
        await supabase.auth.signOut();
        throw new Error(`Phone stamping failed: ${stampErr.message ?? String(stampErr)}`);
      }

      log.event('auth.session_started', { phone_country: normalized.slice(0, 3) });
      // Apply any follow captured from a vouch://follow link the user opened
      // before they had a session. Best-effort, non-blocking.
      await applyPendingFollow();
      return data;
    },
  });
