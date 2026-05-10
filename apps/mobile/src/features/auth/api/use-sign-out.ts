import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useSignOut = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
      log.event('auth.signed_out');
      qc.clear();
    },
  });
};
