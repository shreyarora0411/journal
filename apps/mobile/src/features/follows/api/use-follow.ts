import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followKeys } from './keys';

export const useFollow = () => {
  const qc = useQueryClient();
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (followedId: string) => {
      if (!viewerId) throw new Error('Not signed in');
      if (viewerId === followedId) throw new Error('Cannot follow yourself');
      const supabase = getSupabase();
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: viewerId, followed_id: followedId });
      if (error && error.code !== '23505') throw error; // ignore "already exists"

      // Activity stream: emit a follow_started row so the followee's
      // activity feed reflects the new connection (Session 2 task 5).
      // Best-effort — failure is non-blocking.
      supabase
        .from('activity')
        .insert({
          user_id: viewerId,
          type: 'follow_started',
          payload: { followed_user_id: followedId },
        })
        .then(({ error: actErr }) => {
          if (actErr) log.warn('activity insert failed', { error: actErr.message });
        });

      log.event('follow.created');
      return { followedId };
    },
    onMutate: async (followedId) => {
      await qc.cancelQueries({ queryKey: followKeys.status(followedId) });
      const prev = qc.getQueryData(followKeys.status(followedId));
      qc.setQueryData(followKeys.status(followedId), true);
      return { prev };
    },
    onError: (_err, followedId, ctx) => {
      qc.setQueryData(followKeys.status(followedId), ctx?.prev ?? false);
    },
    onSettled: (result) => {
      if (result) {
        qc.invalidateQueries({ queryKey: followKeys.status(result.followedId) });
        qc.invalidateQueries({ queryKey: followKeys.counts(result.followedId) });
        if (viewerId) qc.invalidateQueries({ queryKey: followKeys.counts(viewerId) });
        // Friend-graph results may now include the followee's trips.
        qc.invalidateQueries({ queryKey: ['feed'] });
        qc.invalidateQueries({ queryKey: ['search'] });
      }
    },
  });
};

export const useUnfollow = () => {
  const qc = useQueryClient();
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (followedId: string) => {
      if (!viewerId) throw new Error('Not signed in');
      const supabase = getSupabase();
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', viewerId)
        .eq('followed_id', followedId);
      if (error) throw error;
      log.event('follow.deleted');
      return { followedId };
    },
    onMutate: async (followedId) => {
      await qc.cancelQueries({ queryKey: followKeys.status(followedId) });
      const prev = qc.getQueryData(followKeys.status(followedId));
      qc.setQueryData(followKeys.status(followedId), false);
      return { prev };
    },
    onError: (_err, followedId, ctx) => {
      qc.setQueryData(followKeys.status(followedId), ctx?.prev ?? true);
    },
    onSettled: (result) => {
      if (result) {
        qc.invalidateQueries({ queryKey: followKeys.status(result.followedId) });
        qc.invalidateQueries({ queryKey: followKeys.counts(result.followedId) });
        if (viewerId) qc.invalidateQueries({ queryKey: followKeys.counts(viewerId) });
        qc.invalidateQueries({ queryKey: ['feed'] });
        qc.invalidateQueries({ queryKey: ['search'] });
      }
    },
  });
};
