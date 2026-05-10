import { log } from '@/lib/log';
import { hashPhones } from '@/lib/phone-hash';
import { getSupabase } from '@/lib/supabase';
import { useMutation } from '@tanstack/react-query';

type Vars = { phoneNumbers: string[] };
type Result = { matchedUserIds: string[] };

/**
 * Hash contact phone numbers client-side, then call the match-contacts edge
 * function. The function applies a server-side pepper before lookup.
 */
export const useMatchContacts = () =>
  useMutation({
    mutationFn: async ({ phoneNumbers }: Vars): Promise<Result> => {
      const hashes = await hashPhones(phoneNumbers);
      if (hashes.length === 0) return { matchedUserIds: [] };

      const supabase = getSupabase();
      const { data, error } = await supabase.functions.invoke<{ matched_user_ids: string[] }>(
        'match-contacts',
        { body: { hashes } },
      );
      if (error) throw error;
      const matched = data?.matched_user_ids ?? [];
      log.event('onboarding.contacts_matched', { count: matched.length });
      return { matchedUserIds: matched };
    },
  });
