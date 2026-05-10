import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { PhoneSchema } from '@journal/shared';
import { useMutation } from '@tanstack/react-query';

type Vars = { phone: string };

/**
 * Sends a phone OTP. Twilio Verify is configured server-side to deliver via
 * WhatsApp first, falling back to SMS — that fallback is server-side, so the
 * client always passes channel: 'whatsapp'.
 */
export const useSignInWithPhone = () =>
  useMutation({
    mutationFn: async ({ phone }: Vars) => {
      const normalized = PhoneSchema.parse(phone);
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalized,
        options: { channel: 'whatsapp' },
      });
      if (error) throw error;
      log.event('auth.otp_sent');
      return { phone: normalized };
    },
  });
