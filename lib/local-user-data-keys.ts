import { logicalKeyFromProtectedKey } from './protected-storage-core.ts';

export const LEGACY_APP_STORAGE_KEY = '@kad/app-state/v1';
export const APP_STORAGE_KEY_PREFIX = '@kad/app-state/v2';
export const THEME_STORAGE_KEY = '@kad/theme-preference/v1';
export const LEGACY_SIMULATION_STORAGE_KEY = '@kad/simulation-session/v1';
export const LEGACY_SIMULATION_HISTORY_KEY = '@kad/simulation-history/v1';
export const SIMULATION_STORAGE_KEY_PREFIX = '@kad/simulation-session/v2';
export const SIMULATION_HISTORY_KEY_PREFIX = '@kad/simulation-history/v2';
export const ESSAY_DRAFT_PREFIX = '@kad/essay-draft/';

const GUEST_MODE_KEY = '@kad/auth/guest-mode/v1';
const ONBOARDING_PREFIX = '@kad/onboarding/completed/v1/';
const TRAIL_SELECTION_PREFIX = '@kad/trails/selection/v1';

export function appStorageKey(ownerId: string) {
  return `${APP_STORAGE_KEY_PREFIX}:${ownerId}`;
}

export function simulationStorageKey(ownerId: string) {
  return `${SIMULATION_STORAGE_KEY_PREFIX}:${ownerId}`;
}

export function simulationHistoryKey(ownerId: string) {
  return `${SIMULATION_HISTORY_KEY_PREFIX}:${ownerId}`;
}

function isOwnerEssayKey(key: string, ownerId: string) {
  if (!key.startsWith(ESSAY_DRAFT_PREFIX)) return false;
  const suffix = key.slice(ESSAY_DRAFT_PREFIX.length);
  if (ownerId !== 'guest') return suffix.startsWith(`${ownerId}/`);
  return suffix.startsWith('guest/') || !suffix.includes('/');
}

export function localUserDataInventory(ownerId: string, physicalKeys: readonly string[]) {
  const protectedLogicalKeys = physicalKeys
    .map(logicalKeyFromProtectedKey)
    .filter((key): key is string => Boolean(key));
  const privateLogicalKeys = new Set([
    appStorageKey(ownerId),
    simulationStorageKey(ownerId),
    simulationHistoryKey(ownerId),
    ...physicalKeys.filter((key) => isOwnerEssayKey(key, ownerId)),
    ...protectedLogicalKeys.filter((key) => isOwnerEssayKey(key, ownerId)),
  ]);

  if (ownerId === 'guest') {
    privateLogicalKeys.add(LEGACY_APP_STORAGE_KEY);
    privateLogicalKeys.add(LEGACY_SIMULATION_STORAGE_KEY);
    privateLogicalKeys.add(LEGACY_SIMULATION_HISTORY_KEY);
  }

  return {
    privateLogicalKeys: [...privateLogicalKeys],
    plainKeys: [
      THEME_STORAGE_KEY,
      `${ONBOARDING_PREFIX}${ownerId}`,
      `${TRAIL_SELECTION_PREFIX}:${ownerId}`,
      ...(ownerId === 'guest' ? [GUEST_MODE_KEY] : []),
    ],
  };
}
