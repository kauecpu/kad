import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';

type AsyncKeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type SecureKeyStore = AsyncKeyValueStore;

type ProtectedStorageDependencies = {
  storage: AsyncKeyValueStore;
  keyStore: SecureKeyStore;
  randomBytes(length: number): Promise<Uint8Array>;
};

type Envelope = {
  version: 1;
  algorithm: 'xchacha20-poly1305';
  nonce: string;
  ciphertext: string;
};

const PROTECTED_PREFIX = '@kad/protected/v1/';
const KEY_PREFIX = 'kad.protected-storage.key.v1.';
const KEY_BYTES = 32;
const NONCE_BYTES = 24;

function ownerToken(ownerId: string) {
  return ownerId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'guest';
}

export function protectedPhysicalKey(logicalKey: string): string {
  return `${PROTECTED_PREFIX}${encodeURIComponent(logicalKey)}`;
}

export function logicalKeyFromProtectedKey(physicalKey: string): string | null {
  if (!physicalKey.startsWith(PROTECTED_PREFIX)) return null;
  try {
    return decodeURIComponent(physicalKey.slice(PROTECTED_PREFIX.length));
  } catch {
    return null;
  }
}

export function protectedOwnerKey(ownerId: string): string {
  return `${KEY_PREFIX}${ownerToken(ownerId)}`;
}

function parseEnvelope(value: string): Envelope {
  const parsed = JSON.parse(value) as Partial<Envelope>;
  if (
    parsed.version !== 1 ||
    parsed.algorithm !== 'xchacha20-poly1305' ||
    typeof parsed.nonce !== 'string' ||
    typeof parsed.ciphertext !== 'string'
  ) {
    throw new Error('protected-storage-invalid-envelope');
  }
  return parsed as Envelope;
}

export function createProtectedStorage({
  storage,
  keyStore,
  randomBytes,
}: ProtectedStorageDependencies) {
  const pendingOwnerKeys = new Map<string, Promise<Uint8Array>>();
  const activeOwnerWrites = new Map<string, Set<Promise<void>>>();
  const deletingOwners = new Set<string>();

  async function readKey(ownerId: string): Promise<Uint8Array | null> {
    const encoded = await keyStore.getItem(protectedOwnerKey(ownerId));
    if (encoded === null) return null;
    const key = hexToBytes(encoded);
    if (key.length !== KEY_BYTES) throw new Error('protected-storage-invalid-key');
    return key;
  }

  async function getOrCreateKey(ownerId: string) {
    const current = await readKey(ownerId);
    if (current) return current;
    const pending = pendingOwnerKeys.get(ownerId);
    if (pending) return pending;

    const creation = (async () => {
      const secondRead = await readKey(ownerId);
      if (secondRead) return secondRead;
      const next = await randomBytes(KEY_BYTES);
      if (next.length !== KEY_BYTES) throw new Error('protected-storage-invalid-random-key');
      await keyStore.setItem(protectedOwnerKey(ownerId), bytesToHex(next));
      const verified = await readKey(ownerId);
      if (!verified || bytesToHex(verified) !== bytesToHex(next)) {
        throw new Error('protected-storage-key-verification-failed');
      }
      return verified;
    })();
    pendingOwnerKeys.set(ownerId, creation);
    try {
      return await creation;
    } finally {
      pendingOwnerKeys.delete(ownerId);
    }
  }

  async function decrypt(logicalKey: string, ownerId: string, envelopeValue: string) {
    const key = await readKey(ownerId);
    if (!key) throw new Error('protected-storage-key-missing');
    const envelope = parseEnvelope(envelopeValue);
    const nonce = hexToBytes(envelope.nonce);
    if (nonce.length !== NONCE_BYTES) throw new Error('protected-storage-invalid-nonce');
    const aad = utf8ToBytes(`${ownerId}\u0000${logicalKey}`);
    const plaintext = xchacha20poly1305(key, nonce, aad).decrypt(
      hexToBytes(envelope.ciphertext)
    );
    return bytesToUtf8(plaintext);
  }

  async function writeValue(logicalKey: string, ownerId: string, value: string) {
    const key = await getOrCreateKey(ownerId);
    const nonce = await randomBytes(NONCE_BYTES);
    if (nonce.length !== NONCE_BYTES) throw new Error('protected-storage-invalid-random-nonce');
    const aad = utf8ToBytes(`${ownerId}\u0000${logicalKey}`);
    const ciphertext = xchacha20poly1305(key, nonce, aad).encrypt(utf8ToBytes(value));
    const envelope: Envelope = {
      version: 1,
      algorithm: 'xchacha20-poly1305',
      nonce: bytesToHex(nonce),
      ciphertext: bytesToHex(ciphertext),
    };
    await storage.setItem(protectedPhysicalKey(logicalKey), JSON.stringify(envelope));
  }

  async function write(logicalKey: string, ownerId: string, value: string) {
    if (deletingOwners.has(ownerId)) throw new Error('protected-storage-owner-deleting');
    const operation = writeValue(logicalKey, ownerId, value);
    const ownerWrites = activeOwnerWrites.get(ownerId) ?? new Set<Promise<void>>();
    ownerWrites.add(operation);
    activeOwnerWrites.set(ownerId, ownerWrites);
    try {
      await operation;
    } finally {
      ownerWrites.delete(operation);
      if (ownerWrites.size === 0) activeOwnerWrites.delete(ownerId);
    }
  }

  return {
    async getItem(
      logicalKey: string,
      ownerId: string,
      validateLegacy: (value: string) => boolean
    ): Promise<string | null> {
      const physicalKey = protectedPhysicalKey(logicalKey);
      const protectedValue = await storage.getItem(physicalKey);
      if (protectedValue !== null) {
        const plaintext = await decrypt(logicalKey, ownerId, protectedValue);
        if (!validateLegacy(plaintext)) throw new Error('protected-storage-invalid-plaintext');
        return plaintext;
      }

      const legacyValue = await storage.getItem(logicalKey);
      if (legacyValue === null || !validateLegacy(legacyValue)) return null;
      try {
        await write(logicalKey, ownerId, legacyValue);
        const migratedValue = await storage.getItem(physicalKey);
        if (migratedValue === null) throw new Error('protected-storage-migration-missing');
        const verified = await decrypt(logicalKey, ownerId, migratedValue);
        if (verified !== legacyValue || !validateLegacy(verified)) {
          throw new Error('protected-storage-migration-verification-failed');
        }
        await storage.removeItem(logicalKey);
      } catch {
        await storage.removeItem(physicalKey).catch(() => {});
      }
      return legacyValue;
    },
    setItem: write,
    async removeItem(logicalKey: string) {
      await Promise.all([
        storage.removeItem(protectedPhysicalKey(logicalKey)),
        storage.removeItem(logicalKey),
      ]);
    },
    async beginOwnerDeletion(ownerId: string) {
      deletingOwners.add(ownerId);
      await Promise.all(activeOwnerWrites.get(ownerId) ?? []);
    },
    cancelOwnerDeletion(ownerId: string) {
      deletingOwners.delete(ownerId);
    },
    async deleteOwnerKey(ownerId: string) {
      try {
        await keyStore.removeItem(protectedOwnerKey(ownerId));
      } finally {
        deletingOwners.delete(ownerId);
      }
    },
  };
}
