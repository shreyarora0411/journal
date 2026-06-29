import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import type { VouchType } from '@journal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type AskRequest = {
  id: string;
  requester_user_id: string;
  destination_text: string;
  request_text: string;
  status: 'open' | 'closed';
  created_at: string;
  requester: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null;
};

export type AskResponse = {
  id: string;
  request_id: string;
  responder_user_id: string;
  text: string | null;
  vouch_id: string | null;
  trip_id: string | null;
  created_at: string;
  responder: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null;
  // The vouch the responder attached, embedded via the vouch_id FK. Null for a
  // free-text-only reply, or if the requester can't see it under the vouches
  // circle-read policy — so the thread must fall back to free text gracefully.
  vouch: { id: string; text: string; vouch_type: VouchType; destination_text: string } | null;
};

/** A vouch the current user authored — the pool a responder draws from when
 *  attaching one of their own vouches to an Ask reply. */
export type MyVouch = {
  id: string;
  text: string;
  vouch_type: VouchType;
  destination_text: string;
  created_at: string;
};

const REQ_SELECT =
  'id, requester_user_id, destination_text, request_text, status, created_at, ' +
  'requester:requester_user_id(display_name, handle, avatar_url)';

/** Requests the current user sent. */
export const useSentRequests = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['ask', 'sent', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AskRequest[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('recommendation_requests')
        .select(REQ_SELECT)
        .eq('requester_user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as unknown as AskRequest[];
    },
  });
};

/** Open requests addressed to the user's circle that they can answer.
 *  RLS (rec_req_circle_read) already restricts to requests from people who
 *  have an accepted edge to the viewer; we just exclude the viewer's own. */
export const useInboxRequests = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['ask', 'inbox', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AskRequest[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('recommendation_requests')
        .select(REQ_SELECT)
        .neq('requester_user_id', userId)
        .eq('status', 'open')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as unknown as AskRequest[];
    },
  });
};

/** Responses to a given request. */
export const useRequestResponses = (requestId: string | null) => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['ask', 'responses', requestId],
    enabled: Boolean(userId) && Boolean(requestId),
    queryFn: async (): Promise<AskResponse[]> => {
      if (!requestId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('recommendation_responses')
        .select(
          'id, request_id, responder_user_id, text, vouch_id, trip_id, created_at, ' +
            'responder:responder_user_id(display_name, handle, avatar_url), ' +
            'vouch:vouch_id(id, text, vouch_type, destination_text)',
        )
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });
      if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as unknown as AskResponse[];
    },
  });
};

/** The current user's own vouches, newest first — the set a responder can
 *  attach to an Ask reply. Small per-user; the screen filters it to the
 *  request's destination before showing the picker. */
export const useMyVouches = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['ask', 'my-vouches', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MyVouch[]> => {
      if (!userId) return [];
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('vouches')
        .select('id, text, vouch_type, destination_text, created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as unknown as MyVouch[];
    },
  });
};

export const useCreateRequest = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async (vars: { destinationText: string; requestText: string }) => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('recommendation_requests')
        .insert({
          requester_user_id: userId,
          destination_text: vars.destinationText.trim(),
          request_text: vars.requestText.trim(),
          audience: 'trusted_circle',
          status: 'open',
        })
        .select('id')
        .single();
      if (error) throw error;
      log.event('ask.request_created');
      return data as { id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ask', 'sent', userId] }),
  });
};

export const useRespondToRequest = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async (vars: {
      requestId: string;
      text?: string;
      vouchId?: string;
      tripId?: string;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();
      const { error } = await supabase.from('recommendation_responses').insert({
        request_id: vars.requestId,
        responder_user_id: userId,
        text: vars.text?.trim() || null,
        vouch_id: vars.vouchId ?? null,
        trip_id: vars.tripId ?? null,
      });
      if (error) throw error;
      log.event('ask.response_submitted', { with_vouch: Boolean(vars.vouchId) });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ask', 'responses', vars.requestId] });
      qc.invalidateQueries({ queryKey: ['ask', 'inbox', userId] });
    },
  });
};
