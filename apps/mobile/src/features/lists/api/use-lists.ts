import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { type List, type ListInput, ListInputSchema } from '@journal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listKeys } from './keys';

export const useMyLists = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: listKeys.mine(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<List[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('owner_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) {
        // Pre-migration friendly.
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as List[];
    },
  });
};

export const useUserLists = (userId: string | null | undefined) =>
  useQuery({
    queryKey: userId ? listKeys.ofUser(userId) : listKeys.ofUser('null'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<List[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('owner_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as List[];
    },
  });

export const useList = (id: string | null | undefined) =>
  useQuery({
    queryKey: id ? listKeys.detail(id) : listKeys.detail('null'),
    enabled: Boolean(id),
    queryFn: async (): Promise<List | null> => {
      if (!id) return null;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return (data as List | null) ?? null;
    },
  });

export const useCreateList = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async (input: ListInput): Promise<List> => {
      if (!userId) throw new Error('Not signed in');
      const parsed = ListInputSchema.parse(input);
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('lists')
        .insert({ ...parsed, owner_id: userId })
        .select('*')
        .single();
      if (error) throw error;
      log.event('list.created');
      return data as List;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listKeys.mine(userId) });
    },
  });
};
