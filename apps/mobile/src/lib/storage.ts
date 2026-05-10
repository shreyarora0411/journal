import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Storage adapter for the Supabase auth client.
 *
 * SecureStore is the right home for the session token but limits values to
 * ~2 KB. Supabase tokens are usually well under that, but to be safe we fall
 * back to AsyncStorage for any oversized payload (very rare in practice).
 */
const SECURE_VALUE_LIMIT = 2000;

export const supabaseStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const secure = await SecureStore.getItemAsync(key).catch(() => null);
    if (secure != null) return secure;
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length > SECURE_VALUE_LIMIT) {
      await AsyncStorage.setItem(key, value);
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
      return;
    }
    await SecureStore.setItemAsync(key, value);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};
