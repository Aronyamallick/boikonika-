import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Secrets (the refresh token, the device id) live in the Keychain / Keystore. The web build — used only
 * for previews — has no secure store, so it falls back to local storage there.
 */
export const secure = {
  get: (key: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: (key: string, value: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value)),
  remove: (key: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key)),
};

/** Plain preferences and cached screens (nothing secret). Failures are ignored: the app works without them. */
export const prefs = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => undefined);
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};
