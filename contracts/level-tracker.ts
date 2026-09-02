import { applyLevelActivity, emptyLevelLedger, isLevelActivity, levelProgress, type LevelActivity, type LevelLedger, type LevelSnapshot } from './levels.ts';

export type LevelState = {
  owner: string | null; status: 'loading' | 'ready' | 'pending' | 'unavailable';
  progress: LevelSnapshot | null; pending: number; storageError: boolean;
};
type Cache = { version: 1; ledger: LevelLedger; confirmed: number | null; pending: LevelActivity[] };
type Storage = { read: (owner: string) => Promise<string | null>; write: (owner: string, value: string) => Promise<void>; remove?: (owner: string) => Promise<void> };
export type LevelRemote = (owner: string, activity?: LevelActivity) => Promise<{ totalXp: number }>;
const blank = (): Cache => ({ version: 1, ledger: emptyLevelLedger(), confirmed: null, pending: [] });
const validXp = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

export function createLevelTracker(storage: Storage, remote: LevelRemote) {
  let owner: string | null = null;
  let generation = 0;
  let cache = blank();
  let loaded = false;
  let ready: Promise<void> = Promise.resolve();
  let writeQueue = Promise.resolve();
  let syncing: { generation: number; promise: Promise<void> } | null = null;
  let state: LevelState = { owner, status: 'loading', progress: null, pending: 0, storageError: false };
  const listeners = new Set<() => void>();
  const emit = (status: LevelState['status'], storageError = state.storageError) => {
    const xp = owner ? cache.confirmed : loaded ? cache.ledger.totalXp : null;
    state = { owner, status, pending: cache.pending.length, progress: xp === null ? null : levelProgress(xp), storageError };
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
          cache.confirmed = result.totalXp;
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
            const saved = JSON.parse(raw) as Cache;
            if (saved.version !== 1 || !saved.ledger || !validXp(saved.ledger.totalXp) || !Array.isArray(saved.ledger.entries) || !Array.isArray(saved.pending) || !saved.pending.every(isLevelActivity) || !(saved.confirmed === null || validXp(saved.confirmed))) throw new Error('Invalid XP cache');
            cache = saved;
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
      } else cache.ledger = applyLevelActivity(cache.ledger, activity, activity.occurredAt);
      emit(owner ? 'pending' : 'ready');
      try { await persist(gen); } catch { return; }
      if (gen === generation && owner) void sync();
    },
    sync,
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
