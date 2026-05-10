import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthState = {
  session: Session | null;
  initializing: boolean;
  setSession: (session: Session | null) => void;
  setInitializing: (initializing: boolean) => void;
};

/**
 * Zustand mirror of the Supabase auth session, for non-async access from
 * components and effects that don't want to await getSession().
 */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initializing: true,
  setSession: (session) => set({ session }),
  setInitializing: (initializing) => set({ initializing }),
}));
