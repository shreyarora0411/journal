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

/**
 * Whether SecureStore can actually write on this build. Simulator and
 * sideloaded builds may lack the keychain-access-groups entitlement, in
 * which case `setValueWithKeyAsync` throws "A required entitlement isn't
 * present." We probe once, lazily, and cache the result — if SecureStore
 * can't write, the adapter falls back to AsyncStorage for everything so
 * auth still works.
 *
 * Auth tokens in AsyncStorage are less protected than in the Keychain,
 * but a non-functioning login is worse. Production builds with proper
 * entitlements keep using SecureStore.
 */
let secureStoreUsable: boolean | null = null;

const probeSecureStore = async (): Promise<boolean> => {
  if (secureStoreUsable !== null) return secureStoreUsable;
  try {
    await SecureStore.setItemAsync('__lore_probe__', '1');
    await SecureStore.deleteItemAsync('__lore_probe__').catch(() => undefined);
    secureStoreUsable = true;
  } catch {
    secureStoreUsable = false;
  }
  return secureStoreUsable;
};

export const supabaseStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (isWeb) return webStorage.getItem(key);
    if (await probeSecureStore()) {
      const secure = await SecureStore.getItemAsync(key).catch(() => null);
      if (secure != null) return secure;
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isWeb) {
      webStorage.setItem(key, value);
      return;
    }
    // Oversized values, or any value when SecureStore is unavailable,
    // go to AsyncStorage.
    if (value.length > SECURE_VALUE_LIMIT || !(await probeSecureStore())) {
      await AsyncStorage.setItem(key, value);
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
      await AsyncStorage.removeItem(key).catch(() => undefined);
    } catch {
      // SecureStore failed despite the probe — degrade rather than
      // failing the whole auth flow.
      secureStoreUsable = false;
      await AsyncStorage.setItem(key, value);
    }
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
