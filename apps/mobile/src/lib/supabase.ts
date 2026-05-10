import 'react-native-url-polyfill/auto';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { supabaseStorageAdapter } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (client) return client;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase env not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  client = createClient(url, anonKey, {
    auth: {
      storage: supabaseStorageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
};

export const isSupabaseConfigured = (): boolean => Boolean(url && anonKey);
