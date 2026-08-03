import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { createSimulationSession } from '@/lib/simulations';
import { useAuth } from '@/providers/auth-provider';
import type { AlternativeId, SimulationConfig, SimulationSession } from '@/types';

const LEGACY_STORAGE_KEY = '@kad/simulation-session/v1';
const LEGACY_HISTORY_STORAGE_KEY = '@kad/simulation-history/v1';
const STORAGE_KEY_PREFIX = '@kad/simulation-session/v2';
const HISTORY_STORAGE_KEY_PREFIX = '@kad/simulation-history/v2';
const HISTORY_LIMIT = 20;

type SimulationContextValue = {
  hydrated: boolean;
  session: SimulationSession | null;
  history: SimulationSession[];
  startSimulation: (config: SimulationConfig) => SimulationSession | null;
  answerQuestion: (questionId: string, alternative: AlternativeId) => void;
  goToQuestion: (index: number) => void;
  tick: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;
  finishSimulation: () => void;
  discardSimulation: () => void;
  clearSimulationData: () => Promise<void>;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const { session: authSession, isLoading: authLoading } = useAuth();
  const [session, setSession] = useState<SimulationSession | null>(null);
  const [history, setHistory] = useState<SimulationSession[]>([]);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);

  const ownerId = authSession?.user.id ?? 'guest';
  const storageKey = authLoading ? null : `${STORAGE_KEY_PREFIX}:${ownerId}`;
  const historyStorageKey = authLoading
    ? null
    : `${HISTORY_STORAGE_KEY_PREFIX}:${ownerId}`;
  const hydrated = Boolean(
    storageKey && historyStorageKey && hydratedStorageKey === storageKey
  );

  useEffect(() => {
    if (!storageKey || !historyStorageKey) return;
    let active = true;
    setHydratedStorageKey(null);
    setSession(null);
    setHistory([]);

    const isGuest = ownerId === 'guest';
    Promise.all([
      AsyncStorage.getItem(storageKey),
      AsyncStorage.getItem(historyStorageKey),
      isGuest ? AsyncStorage.getItem(LEGACY_STORAGE_KEY) : Promise.resolve(null),
      isGuest ? AsyncStorage.getItem(LEGACY_HISTORY_STORAGE_KEY) : Promise.resolve(null),
    ])
      .then(([scopedSession, scopedHistory, legacySession, legacyHistory]) => {
        if (!active) return;
        const rawSession = scopedSession ?? legacySession;
        const rawHistory = scopedHistory ?? legacyHistory;
        if (rawSession) setSession(JSON.parse(rawSession) as SimulationSession);
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory) as SimulationSession[];
          if (Array.isArray(parsed)) setHistory(parsed);
        }
      })
      .catch(() => {
        // Uma sessão inválida não deve impedir o restante do aplicativo de abrir.
      })
      .finally(() => {
        if (active) setHydratedStorageKey(storageKey);
      });

    return () => {
      active = false;
    };
  }, [historyStorageKey, ownerId, storageKey]);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    if (session) {
      AsyncStorage.setItem(storageKey, JSON.stringify(session)).catch(() => {});
    } else {
      AsyncStorage.removeItem(storageKey).catch(() => {});
    }
  }, [hydrated, session, storageKey]);

  useEffect(() => {
    if (!hydrated || !historyStorageKey) return;
    AsyncStorage.setItem(historyStorageKey, JSON.stringify(history)).catch(() => {});
  }, [history, historyStorageKey, hydrated]);

  useEffect(() => {
    if (!hydrated || session?.status !== 'completed') return;
    setHistory((current) => {
      if (current.some((item) => item.id === session.id)) return current;
      return [session, ...current].slice(0, HISTORY_LIMIT);
    });
  }, [hydrated, session]);

  const startSimulation = useCallback((config: SimulationConfig) => {
    const next = createSimulationSession(config);
    if (next) setSession(next);
    return next;
  }, []);

  const answerQuestion = useCallback((questionId: string, alternative: AlternativeId) => {
    setSession((current) =>
      current && current.status !== 'completed'
        ? {
            ...current,
            answers: { ...current.answers, [questionId]: alternative },
          }
        : current
    );
  }, []);

  const goToQuestion = useCallback((index: number) => {
    setSession((current) => {
      if (!current) return current;
      const bounded = Math.max(0, Math.min(index, current.questions.length - 1));
      return { ...current, currentIndex: bounded };
    });
  }, []);

  const tick = useCallback(() => {
    setSession((current) => {
      if (!current || current.status !== 'active') return current;
      const remainingSeconds = Math.max(0, current.remainingSeconds - 1);
      if (remainingSeconds === 0) {
        return {
          ...current,
          remainingSeconds,
          status: 'completed',
          completedAt: new Date().toISOString(),
        };
      }
      return { ...current, remainingSeconds };
    });
  }, []);

  const pauseSimulation = useCallback(() => {
    setSession((current) =>
      current?.status === 'active' ? { ...current, status: 'paused' } : current
    );
  }, []);

  const resumeSimulation = useCallback(() => {
    setSession((current) =>
      current?.status === 'paused' ? { ...current, status: 'active' } : current
    );
  }, []);

  const finishSimulation = useCallback(() => {
    setSession((current) =>
      current && current.status !== 'completed'
        ? {
            ...current,
            status: 'completed',
            completedAt: new Date().toISOString(),
          }
        : current
    );
  }, []);

  const discardSimulation = useCallback(() => setSession(null), []);

  const clearSimulationData = useCallback(async () => {
    setSession(null);
    setHistory([]);
    const keys = [storageKey, historyStorageKey].filter((key): key is string => Boolean(key));
    if (ownerId === 'guest') {
      keys.push(LEGACY_STORAGE_KEY, LEGACY_HISTORY_STORAGE_KEY);
    }
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  }, [historyStorageKey, ownerId, storageKey]);

  const value = useMemo<SimulationContextValue>(
    () => ({
      hydrated,
      session,
      history,
      startSimulation,
      answerQuestion,
      goToQuestion,
      tick,
      pauseSimulation,
      resumeSimulation,
      finishSimulation,
      discardSimulation,
      clearSimulationData,
    }),
    [
      hydrated,
      session,
      history,
      startSimulation,
      answerQuestion,
      goToQuestion,
      tick,
      pauseSimulation,
      resumeSimulation,
      finishSimulation,
      discardSimulation,
      clearSimulationData,
    ]
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation deve ser usado dentro de SimulationProvider');
  }
  return context;
}
