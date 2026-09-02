import * as Crypto from 'expo-crypto';
import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { createLevelTracker, levelActivityPayload, type LevelState } from '@/contracts/level-tracker';
import type { LevelActivity } from '@/contracts/levels';
import { protectedStorage } from '@/lib/protected-storage';
import { levelsStorageKey } from '@/lib/local-user-data-keys';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type LevelsContextValue = { state: LevelState; record: (event: LevelActivity) => void; retry: () => void; clear: () => Promise<void>; markReview: (id: string) => void; consumeReview: (id: string) => boolean };
const Context = createContext<LevelsContextValue | null>(null);
export const levelEventId = () => Crypto.randomUUID();
export function LevelsProvider({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const owner = session?.user.id ?? null;
  const reviewReady = useRef(new Set<string>());
  const tracker = useMemo(() => createLevelTracker({
    read: account => protectedStorage.getItem(levelsStorageKey(account), account, value => { try { return JSON.parse(value)?.version === 1; } catch { return false; } }),
    write: (account, value) => protectedStorage.setItem(levelsStorageKey(account), account, value),
    remove: account => protectedStorage.removeItem(levelsStorageKey(account)),
  }, async (account, event) => {
    if (!supabase) throw new Error('XP unavailable');
    const { data: auth } = await supabase.auth.getSession();
    if (auth.session?.user.id !== account) throw new Error('Account changed');
    const { data, error } = await supabase.rpc('record_level_activity', { p_event: levelActivityPayload(event) });
    if (error) throw error;
    return data;
  }), []);
  const state = useSyncExternalStore(tracker.subscribe, tracker.getState, tracker.getState);
  useEffect(() => {
    reviewReady.current.clear();
    if (!isLoading) void tracker.selectOwner(owner);
  }, [isLoading, owner, tracker]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => { if (value === 'active') void tracker.sync(); });
    const timer = setInterval(() => { if (tracker.getState().pending) void tracker.sync(); }, 30000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [tracker]);
  const actions = useMemo(() => ({
    record: (event: LevelActivity) => { if (!isLoading && tracker.getState().owner === owner) void tracker.record(event); },
    retry: () => { if (tracker.getState().storageError) void tracker.selectOwner(owner); else void tracker.sync(); },
    clear: () => tracker.clear(),
    markReview: (id: string) => { reviewReady.current.add(id); },
    consumeReview: (id: string) => { const ready = reviewReady.current.has(id); reviewReady.current.delete(id); return ready; },
  }), [isLoading, owner, tracker]);
  const value = useMemo<LevelsContextValue>(() => ({ ...actions,
    state: state.owner === owner && !isLoading ? state : { owner, status: 'loading', progress: null, pending: 0, storageError: false },
  }), [actions, isLoading, owner, state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLevels() {
  const value = useContext(Context);
  if (!value) throw new Error('useLevels requires LevelsProvider');
  return value;
}
