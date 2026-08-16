import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { createSimulationSession } from '@/lib/simulations';
import {
  deleteRemoteSimulationSessions,
  loadRemoteSimulationSessions,
  saveRemoteSimulationSession,
} from '@/lib/remote-user-sync';
import {
  mergeSimulationSessions,
  parseStoredSimulation,
  parseStoredSimulationHistory,
  touchSimulationSession,
} from '@/lib/user-sync';
import { useAuth } from '@/providers/auth-provider';
import { useQuestions } from '@/providers/questions-provider';
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
  const { questions } = useQuestions();
  const [session, setSession] = useState<SimulationSession | null>(null);
  const [history, setHistory] = useState<SimulationSession[]>([]);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const sessionRef = useRef<SimulationSession | null>(null);
  sessionRef.current = session;

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
      !isGuest
        ? loadRemoteSimulationSessions(ownerId).catch(() => [])
        : Promise.resolve([]),
    ])
      .then(([scopedSession, scopedHistory, legacySession, legacyHistory, remoteSessions]) => {
        if (!active) return;
        const rawSession = scopedSession ?? legacySession;
        const rawHistory = scopedHistory ?? legacyHistory;
        const localSession = parseStoredSimulation(rawSession);
        const localHistory = parseStoredSimulationHistory(rawHistory);
        const merged = mergeSimulationSessions(
          localSession ? [localSession, ...localHistory] : localHistory,
          remoteSessions,
          HISTORY_LIMIT
        );
        setSession(merged.session);
        setHistory(merged.history);
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
    if (!hydrated || !authSession?.user.id || !sessionRef.current) return;
    const timeout = setTimeout(() => {
      const current = sessionRef.current;
      if (current) saveRemoteSimulationSession(authSession.user.id, current).catch(() => {});
    }, 600);
    return () => clearTimeout(timeout);
  }, [authSession?.user.id, hydrated, session?.id, session?.status, session?.updatedAt]);

  useEffect(() => {
    if (!hydrated || !authSession?.user.id || history.length === 0) return;
    Promise.all(
      history.map((item) => saveRemoteSimulationSession(authSession.user.id, item))
    ).catch(() => {});
  }, [authSession?.user.id, history, hydrated]);

  useEffect(() => {
    if (!hydrated || session?.status !== 'completed') return;
    setHistory((current) => {
      if (current.some((item) => item.id === session.id)) return current;
      return [session, ...current].slice(0, HISTORY_LIMIT);
    });
  }, [hydrated, session]);

  const startSimulation = useCallback((config: SimulationConfig) => {
    const next = createSimulationSession(config, questions);
    if (next) {
      setSession((current) => {
        if (
          authSession?.user.id &&
          current &&
          current.status !== 'completed' &&
          current.id !== next.id
        ) {
          deleteRemoteSimulationSessions(authSession.user.id, current.id).catch(() => {});
        }
        return next;
      });
    }
    return next;
  }, [authSession?.user.id, questions]);

  const answerQuestion = useCallback((questionId: string, alternative: AlternativeId) => {
    setSession((current) =>
      current && current.status !== 'completed'
        ? touchSimulationSession({
            ...current,
            answers: { ...current.answers, [questionId]: alternative },
          })
        : current
    );
  }, []);

  const goToQuestion = useCallback((index: number) => {
    setSession((current) => {
      if (!current) return current;
      const bounded = Math.max(0, Math.min(index, current.questions.length - 1));
      return touchSimulationSession({ ...current, currentIndex: bounded });
    });
  }, []);

  const tick = useCallback(() => {
    setSession((current) => {
      if (!current || current.status !== 'active') return current;
      const remainingSeconds = Math.max(0, current.remainingSeconds - 1);
      if (remainingSeconds === 0) {
        return touchSimulationSession({
          ...current,
          remainingSeconds,
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
      }
      const next = { ...current, remainingSeconds };
      return remainingSeconds % 10 === 0 ? touchSimulationSession(next) : next;
    });
  }, []);

  const pauseSimulation = useCallback(() => {
    setSession((current) =>
      current?.status === 'active'
        ? touchSimulationSession({ ...current, status: 'paused' })
        : current
    );
  }, []);

  const resumeSimulation = useCallback(() => {
    setSession((current) =>
      current?.status === 'paused'
        ? touchSimulationSession({ ...current, status: 'active' })
        : current
    );
  }, []);

  const finishSimulation = useCallback(() => {
    setSession((current) =>
      current && current.status !== 'completed'
        ? touchSimulationSession({
            ...current,
            status: 'completed',
            completedAt: new Date().toISOString(),
          })
        : current
    );
  }, []);

  const discardSimulation = useCallback(() => {
    setSession((current) => {
      if (authSession?.user.id && current && current.status !== 'completed') {
        deleteRemoteSimulationSessions(authSession.user.id, current.id).catch(() => {});
      }
      return null;
    });
  }, [authSession?.user.id]);

  const clearSimulationData = useCallback(async () => {
    setSession(null);
    setHistory([]);
    const keys = [storageKey, historyStorageKey].filter((key): key is string => Boolean(key));
    if (ownerId === 'guest') {
      keys.push(LEGACY_STORAGE_KEY, LEGACY_HISTORY_STORAGE_KEY);
    }
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
    if (authSession?.user.id) {
      await deleteRemoteSimulationSessions(authSession.user.id).catch(() => {});
    }
  }, [authSession?.user.id, historyStorageKey, ownerId, storageKey]);

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
