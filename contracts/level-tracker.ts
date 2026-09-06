import { applyLevelActivity, emptyLevelLedger, isLevelActivity, levelProgress, type LevelActivity, type LevelLedger, type LevelSnapshot } from './levels.ts';
import { achievementsFromLedger, type AchievementProgress, type AchievementUnlock } from './achievements.ts';

export type LevelNotice = {
  id: string;
  xp: number;
  level: number | null;
  achievements: AchievementUnlock[];
};

export type LevelState = {
  owner: string | null; status: 'loading' | 'ready' | 'pending' | 'unavailable';
  progress: LevelSnapshot | null; pending: number; storageError: boolean;
  achievements: AchievementProgress[];
  notices: LevelNotice[];
};
type Cache = {
  version: 2;
  ledger: LevelLedger;
  confirmed: number | null;
  pending: LevelActivity[];
  achievements: AchievementProgress[];
  notices: LevelNotice[];
};
type Storage = { read: (owner: string) => Promise<string | null>; write: (owner: string, value: string) => Promise<void>; remove?: (owner: string) => Promise<void> };
export type LevelRemoteResult = {
  totalXp: number;
  level?: number;
  awardedXp?: number;
  achievements?: AchievementProgress[];
  newAchievements?: AchievementUnlock[];
};
export type LevelRemote = (owner: string, activity?: LevelActivity) => Promise<LevelRemoteResult>;
const blank = (): Cache => ({ version: 2, ledger: emptyLevelLedger(), confirmed: null, pending: [], achievements: [], notices: [] });
const validXp = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const validAchievements = (value: unknown): value is AchievementProgress[] => Array.isArray(value) && value.every(item =>
  item && typeof item === 'object' && typeof item.key === 'string' && typeof item.title === 'string' &&
  typeof item.threshold === 'number' && typeof item.value === 'number' && typeof item.progress === 'number'
);
const validUnlocks = (value: unknown): value is AchievementUnlock[] => Array.isArray(value) && value.every(item =>
  item && typeof item === 'object' && typeof item.key === 'string' && typeof item.title === 'string' &&
  typeof item.description === 'string' && typeof item.icon === 'string' &&
  (item.unlockedAt === null || typeof item.unlockedAt === 'string')
);
const validNotices = (value: unknown): value is LevelNotice[] => Array.isArray(value) && value.every(item =>
  item && typeof item === 'object' && typeof item.id === 'string' && validXp(item.xp) &&
  (item.level === null || validXp(item.level)) && validUnlocks(item.achievements)
);

export function createLevelTracker(storage: Storage, remote: LevelRemote) {
  let owner: string | null = null;
  let generation = 0;
  let cache = blank();
  let loaded = false;
  let ready: Promise<void> = Promise.resolve();
  let writeQueue = Promise.resolve();
  let syncing: { generation: number; promise: Promise<void> } | null = null;
  let state: LevelState = { owner, status: 'loading', progress: null, pending: 0, storageError: false, achievements: [], notices: [] };
  const listeners = new Set<() => void>();
  const emit = (status: LevelState['status'], storageError = state.storageError) => {
    const xp = owner ? cache.confirmed : loaded ? cache.ledger.totalXp : null;
    state = {
      owner,
      status,
      pending: cache.pending.length,
      progress: xp === null ? null : levelProgress(xp),
      storageError,
      achievements: owner ? cache.achievements : achievementsFromLedger(cache.ledger),
      notices: cache.notices,
    };
    listeners.forEach(fn => fn());
  };
  const persist = async (gen: number) => {
    const key = owner ?? 'guest';
    const value = JSON.stringify(cache);
    // Writes serialize across account changes; the key is captured, never read later.
    const operation = writeQueue.catch(() => {}).then(() => storage.write(key, value));
    writeQueue = operation;
    try { await operation; if (gen === generation && state.storageError) emit(state.status, false); }
    catch { if (gen === generation) emit('unavailable', true); throw new Error('XP storage unavailable'); }
  };
  const sync = (): Promise<void> => {
    const gen = generation;
    if (syncing?.generation === gen) return syncing.promise;
    const task = (async () => {
      await ready;
      if (gen !== generation || !owner || !loaded) return;
      const account = owner;
      try {
        do {
          if (gen !== generation) return;
          const event = cache.pending[0];
          const result = await remote(account, event);
          if (gen !== generation) return;
          if (!validXp(result.totalXp)) throw new Error('Invalid server XP');
          const previousLevel = cache.confirmed === null ? null : levelProgress(cache.confirmed).level;
          cache.confirmed = result.totalXp;
          if (result.achievements !== undefined) {
            if (!validAchievements(result.achievements)) throw new Error('Invalid server achievements');
            cache.achievements = result.achievements;
          }
          const nextLevel = result.level ?? levelProgress(result.totalXp).level;
          if (result.newAchievements !== undefined && !validUnlocks(result.newAchievements)) throw new Error('Invalid server achievement unlocks');
          const unlocked = result.newAchievements ?? [];
          const awardedXp = validXp(result.awardedXp) ? result.awardedXp : 0;
          if (event && (awardedXp > 0 || unlocked.length > 0 || (previousLevel !== null && nextLevel > previousLevel))) {
            cache.notices.push({
              id: event.id,
              xp: awardedXp,
              level: previousLevel !== null && nextLevel > previousLevel ? nextLevel : null,
              achievements: unlocked,
            });
          }
          if (event) cache.pending = cache.pending.filter(e => e.id !== event.id);
          await persist(gen);
          emit(cache.pending.length ? 'pending' : 'ready');
        } while (cache.pending.length && gen === generation);
      } catch { if (gen === generation) emit('unavailable'); }
    })();
    syncing = { generation: gen, promise: task };
    void task.finally(() => { if (syncing?.promise === task) syncing = null; });
    return task;
  };
  return {
    getState: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async selectOwner(next: string | null) {
      const gen = ++generation;
      owner = next; loaded = false; cache = blank(); emit('loading', false);
      ready = (async () => {
        try {
          // Do not read an older disk snapshot while our own writes are outstanding.
          await writeQueue.catch(() => {});
          const raw = await storage.read(next ?? 'guest');
          if (gen !== generation) return;
          if (raw) {
            const saved = JSON.parse(raw) as {
              version?: number;
              ledger?: LevelLedger;
              confirmed?: number | null;
              pending?: LevelActivity[];
              achievements?: AchievementProgress[];
              notices?: LevelNotice[];
            };
            if ((saved.version !== 1 && saved.version !== 2) || !saved.ledger || !validXp(saved.ledger.totalXp) || !Array.isArray(saved.ledger.entries) || !Array.isArray(saved.pending) || !saved.pending.every(isLevelActivity) || !(saved.confirmed === null || validXp(saved.confirmed))) throw new Error('Invalid XP cache');
            cache = {
              version: 2,
              ledger: saved.ledger,
              confirmed: saved.confirmed,
              pending: saved.pending,
              achievements: validAchievements(saved.achievements) ? saved.achievements : [],
              notices: validNotices(saved.notices) ? saved.notices : [],
            };
          }
          loaded = true;
          emit(next ? cache.pending.length ? 'pending' : 'loading' : 'ready');
        } catch { if (gen === generation) emit('unavailable', true); }
      })();
      await ready;
      if (gen === generation && loaded && next) await sync();
    },
    async record(activity: LevelActivity) {
      const gen = generation;
      await ready;
      if (gen !== generation || !loaded || !isLevelActivity(activity)) return;
      if (owner) {
        if (!cache.pending.some(e => e.id === activity.id)) cache.pending.push(activity);
      } else {
        const before = achievementsFromLedger(cache.ledger);
        const beforeLevel = levelProgress(cache.ledger.totalXp).level;
        const beforeXp = cache.ledger.totalXp;
        cache.ledger = applyLevelActivity(cache.ledger, activity, activity.occurredAt);
        const after = achievementsFromLedger(cache.ledger);
        const afterLevel = levelProgress(cache.ledger.totalXp).level;
        const newAchievements = after.filter(item => item.unlockedAt && !before.find(previous => previous.key === item.key)?.unlockedAt);
        const awardedXp = cache.ledger.totalXp - beforeXp;
        if (awardedXp > 0 || newAchievements.length > 0 || afterLevel > beforeLevel) {
          cache.notices.push({ id: activity.id, xp: awardedXp, level: afterLevel > beforeLevel ? afterLevel : null, achievements: newAchievements });
        }
      }
      emit(owner ? 'pending' : 'ready');
      try { await persist(gen); } catch { return; }
      if (gen === generation && owner) void sync();
    },
    sync,
    async consumeNotice(id: string) {
      const gen = generation;
      await ready;
      if (gen !== generation || !loaded) return;
      cache.notices = cache.notices.filter(notice => notice.id !== id);
      emit(state.status);
      try { await persist(gen); } catch { /* O aviso já foi consumido em memória. */ }
    },
    async clear() {
      const gen = ++generation;
      const key = owner ?? 'guest';
      cache = blank(); loaded = true; emit('ready', false);
      try {
        const operation = writeQueue.catch(() => {}).then(() => storage.remove ? storage.remove(key) : storage.write(key, JSON.stringify(cache)));
        writeQueue = operation;
        await operation;
      } catch { if (gen === generation) emit('unavailable', true); }
    },
  };
}

/** Payload omits client-calculated correctness; the server checks published answers. */
export function levelActivityPayload(activity?: LevelActivity): Record<string, unknown> | null {
  if (!activity) return null;
  const base = { id: activity.id, kind: activity.kind, itemId: activity.itemId };
  if (activity.kind === 'question') return { ...base, selected: activity.selected, reviewed: activity.reviewed };
  if (activity.kind === 'flashcard') return { ...base, rating: activity.rating };
  return { ...base, answers: activity.answers.map(q => ({ itemId: q.itemId, selected: q.selected })) };
}
