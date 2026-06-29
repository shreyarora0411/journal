import { applyPendingFollow } from '@/features/invite';
import { log } from '@/lib/log';
import { hashPhone } from '@/lib/phone-hash';
import { getSupabase } from '@/lib/supabase';
import { PhoneSchema } from '@journal/shared';
import { useMutation } from '@tanstack/react-query';

type Vars = { phone: string };

/**
 * Pilot-grade session start with phone-number recovery.
 *
 * Two paths:
 *
 *   A. Returning user — the entered phone has been seen before. We call
 *      `recover-session`, which looks up users.phone_hash and returns a
 *      magic-link token bound to the existing auth.user. The client
 *      redeems it via `verifyOtp` and gets a session as the SAME user.
 *
 *   B. New user — no phone-hash match. We fall back to the original
 *      flow: signInAnonymously() → stamp-phone-hash (which also stamps
 *      a synthetic email on auth.users so this user is recoverable on
 *      the next sign-in).
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

      // ---- Path A: try to recover an existing user by phone -------------
      try {
        const { data: recoverData, error: recoverErr } = await supabase.functions.invoke<{
          found: boolean;
          email?: string;
          emailOtp?: string;
          hashedToken?: string;
        }>('recover-session', { body: { client_hash: clientHashHex } });

        if (!recoverErr && recoverData?.found && recoverData.email && recoverData.emailOtp) {
          // Use the 6-digit email_otp returned by admin.generateLink with
          // type:'email' — the hashed_token + type:'magiclink' path
          // rejects as "Token has expired or is invalid" because that
          // token is meant for the action_link redirect, not for direct
          // verifyOtp.
          const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
            email: recoverData.email,
            token: recoverData.emailOtp,
            type: 'email',
          });
          if (verifyErr) {
            // The phone IS recognized but recovery failed. Do NOT fall
            // through to anonymous signup — that would mint a SECOND
            // account for a known phone, corrupting contact-matching and
            // orphaning the user's existing circle/vouches. Surface a
            // retryable error instead.
            log.warn('recover-session verifyOtp failed for a known phone', {
              error: verifyErr.message,
            });
            throw new Error('We could not sign you back in. Please try again.');
          }
          if (verifyData.session) {
            log.event('auth.session_recovered', {
              phone_country: normalized.slice(0, 3),
            });
            // Apply any follow captured from a lore://follow link the user
            // opened before they had a session. Best-effort, non-blocking.
            await applyPendingFollow();
            return verifyData;
          }
        }

        // Recovery returned found===true but without a usable email/OTP —
        // the phone is still known, so refuse to mint a duplicate account.
        if (!recoverErr && recoverData?.found) {
          log.warn('recover-session matched a known phone but returned no usable token');
          throw new Error('We could not sign you back in. Please try again.');
        }
      } catch (err) {
        // A known-phone recovery failure rethrows above with this exact
        // message — propagate it rather than minting a duplicate account.
        if (
          err instanceof Error &&
          err.message === 'We could not sign you back in. Please try again.'
        ) {
          throw err;
        }
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
      // Apply any follow captured from a lore://follow link the user opened
      // before they had a session. Best-effort, non-blocking.
      await applyPendingFollow();
      return data;
    },
  });
