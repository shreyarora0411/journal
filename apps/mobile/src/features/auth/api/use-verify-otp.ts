import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { OtpCodeSchema, PhoneSchema } from '@journal/shared';
import { useMutation } from '@tanstack/react-query';

type Vars = { phone: string; code: string };

export const useVerifyOtp = () =>
  useMutation({
    mutationFn: async ({ phone, code }: Vars) => {
      const normalized = PhoneSchema.parse(phone);
      const validCode = OtpCodeSchema.parse(code);
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalized,
        token: validCode,
        type: 'sms', // Supabase uses 'sms' for both SMS and WhatsApp via Twilio.
      });
      if (error) throw error;
      log.event('auth.otp_verified');
      return data;
    },
  });
