import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { createProtectedStorage } from './protected-storage-core';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const webSessionKeyStore = {
  async getItem(key: string) {
    return globalThis.sessionStorage?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string) {
    globalThis.sessionStorage?.setItem(key, value);
  },
  async removeItem(key: string) {
    globalThis.sessionStorage?.removeItem(key);
  },
};

const nativeKeyStore = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, secureStoreOptions),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const protectedStorage = createProtectedStorage({
  storage: AsyncStorage,
  keyStore: Platform.OS === 'web' ? webSessionKeyStore : nativeKeyStore,
  randomBytes: (length) => Crypto.getRandomBytesAsync(length),
});
