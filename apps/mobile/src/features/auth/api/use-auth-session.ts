import { log } from '@/lib/log';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useEffect } from 'react';
import { useAuthStore } from '../state';

/**
 * Subscribes to the Supabase session. Call once near the root.
 * Mirrors auth state into the Zustand store and identifies the analytics user.
 */
export const useAuthSession = (): void => {
  const setSession = useAuthStore((s) => s.setSession);
  const setInitializing = useAuthStore((s) => s.setInitializing);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setInitializing(false);
      return;
    }

    const supabase = getSupabase();
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        log.identify(data.session?.user.id ?? null);
        setInitializing(false);
      })
      .catch((err) => {
        log.error('auth.getSession failed', err);
        setInitializing(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      log.identify(session?.user.id ?? null);
      log.debug('auth state', { event });
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [setSession, setInitializing]);
};
