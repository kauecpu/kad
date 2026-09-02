import { createLevelTracker, levelActivityPayload } from '../../../contracts/level-tracker.ts';
import type { LevelActivity } from '../../../contracts/levels.ts';
import { recordRemoteLevelActivity } from '../services/supabase.ts';

const key = (owner: string) => `kad-site/levels/v1/${encodeURIComponent(owner)}`;
export const levelTracker = createLevelTracker({
  read: async owner => globalThis.localStorage?.getItem(key(owner)) ?? null,
  write: async (owner, value) => { globalThis.localStorage?.setItem(key(owner), value); },
  remove: async owner => { globalThis.localStorage?.removeItem(key(owner)); },
}, async (owner, event) => recordRemoteLevelActivity(owner, levelActivityPayload(event)));

export function siteLevelEventId(prefix: string): string {
  return `${prefix}:${globalThis.crypto.randomUUID()}`;
}

export function recordSiteLevelActivity(event: LevelActivity): void {
  void levelTracker.record(event);
}
