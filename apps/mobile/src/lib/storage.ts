import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Storage adapter for the Supabase auth client.
 *
 * On native, SecureStore is the primary store (≤2 KB values) with
 * AsyncStorage as the fallback for oversized payloads.
 *
 * On web, expo-secure-store is unavailable, so we use localStorage directly.
 */
const SECURE_VALUE_LIMIT = 2000;
const isWeb = Platform.OS === 'web';

const webStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

export const supabaseStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (isWeb) return webStorage.getItem(key);
    const secure = await SecureStore.getItemAsync(key).catch(() => null);
    if (secure != null) return secure;
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isWeb) {
      webStorage.setItem(key, value);
      return;
    }
    if (value.length > SECURE_VALUE_LIMIT) {
      await AsyncStorage.setItem(key, value);
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
      return;
    }
    await SecureStore.setItemAsync(key, value);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
  removeItem: async (key: string): Promise<void> => {
    if (isWeb) {
      webStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};
