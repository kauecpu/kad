import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const SECURE_STORE_CHUNK_SIZE = 1800;

type SecureStoreManifest = {
  version: 1;
  generation: string;
  chunks: number;
};

function manifestKey(key: string) {
  return `${key}.manifest`;
}

function chunkKey(key: string, generation: string, index: number) {
  return `${key}.chunk.${generation}.${index}`;
}

function parseManifest(value: string | null): SecureStoreManifest | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<SecureStoreManifest>;
    if (
      parsed.version !== 1 ||
      typeof parsed.generation !== 'string' ||
      !Number.isInteger(parsed.chunks) ||
      !parsed.chunks ||
      parsed.chunks < 1 ||
      parsed.chunks > 32
    ) {
      return null;
    }
    return parsed as SecureStoreManifest;
  } catch {
    return null;
  }
}

async function removeChunkGeneration(key: string, manifest: SecureStoreManifest | null) {
  if (!manifest) return;
  await Promise.all(
    Array.from({ length: manifest.chunks }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, manifest.generation, index))
    )
  );
}

async function readSecureValue(key: string) {
  const manifestValue = await SecureStore.getItemAsync(manifestKey(key));
  const manifest = parseManifest(manifestValue);
  if (manifest) {
    const chunks = await Promise.all(
      Array.from({ length: manifest.chunks }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, manifest.generation, index))
      )
    );
    if (chunks.every((chunk): chunk is string => chunk !== null)) return chunks.join('');

    await Promise.all([
      SecureStore.deleteItemAsync(manifestKey(key)),
      removeChunkGeneration(key, manifest),
    ]);
  } else if (manifestValue) {
    await SecureStore.deleteItemAsync(manifestKey(key));
  }

  return SecureStore.getItemAsync(key);
}

async function writeSecureValue(key: string, value: string) {
  const previousManifest = parseManifest(
    await SecureStore.getItemAsync(manifestKey(key))
  );

  if (value.length <= SECURE_STORE_CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value, secureStoreOptions);
    await Promise.all([
      SecureStore.deleteItemAsync(manifestKey(key)),
      removeChunkGeneration(key, previousManifest),
    ]);
    return;
  }

  const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const chunks = Array.from(
    { length: Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE) },
    (_, index) => value.slice(index * SECURE_STORE_CHUNK_SIZE, (index + 1) * SECURE_STORE_CHUNK_SIZE)
  );
  const nextManifest: SecureStoreManifest = {
    version: 1,
    generation,
    chunks: chunks.length,
  };

  try {
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, generation, index), chunk, secureStoreOptions)
      )
    );
    await SecureStore.setItemAsync(
      manifestKey(key),
      JSON.stringify(nextManifest),
      secureStoreOptions
    );
    await SecureStore.deleteItemAsync(key);
    await removeChunkGeneration(key, previousManifest);
  } catch (error) {
    await removeChunkGeneration(key, nextManifest).catch(() => {});
    throw error;
  }
}

const secureSessionStorage = {
  async getItem(key: string) {
    const stored = await readSecureValue(key);
    if (stored !== null) return stored;

    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      await writeSecureValue(key, legacy);
      await AsyncStorage.removeItem(key);
    }
    return legacy;
  },
  async setItem(key: string, value: string) {
    await writeSecureValue(key, value);
  },
  async removeItem(key: string) {
    const manifest = parseManifest(await SecureStore.getItemAsync(manifestKey(key)));
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(manifestKey(key)),
      removeChunkGeneration(key, manifest),
      AsyncStorage.removeItem(key),
    ]);
  },
};

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          ...(Platform.OS !== 'web' ? { storage: secureSessionStorage } : {}),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
          lock: processLock,
        },
      })
    : null;
