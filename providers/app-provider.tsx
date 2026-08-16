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
import { AppState as ReactNativeAppState } from 'react-native';

import {
  BASIC_DAILY_QUESTION_LIMIT,
  DEFAULT_PROFILE,
  DEFAULT_SUBSCRIPTION,
} from '@/data/user';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  canAnswerWithDailyLimit,
  currentDailyUsage,
  subscriptionWithCurrentStatus,
} from '@/lib/access-rules';
import { sanitizeLegacyGuestProfile } from '@/lib/profile';
import {
  subscriptionAfterCancellation,
  subscriptionHasVerifiedAccess,
  subscriptionIsLoading,
} from '@/lib/subscription-state';
import {
  cancelRemoteSubscription,
  createSubscriptionCheckout,
  loadRemoteSubscription,
  type SubscriptionActionResult,
} from '@/lib/subscriptions';
import { supabase } from '@/lib/supabase';
import {
  loadRemoteStudyData,
  removeRemoteAnswer,
  saveRemoteAnswer,
  setRemoteFavorite,
  setRemoteSavedConcurso,
} from '@/lib/remote-user-data';
import { useAuth } from '@/providers/auth-provider';
import type {
  AlternativeId,
  AnswerRecord,
  BillingCycle,
  DailyQuestionUsage,
  Performance,
  Question,
  Subscription,
  SubscriptionPlan,
  ThemePreference,
  UserProfile,
} from '@/types';

const LEGACY_STORAGE_KEY = '@kad/app-state/v1';
const STORAGE_KEY_PREFIX = '@kad/app-state/v2';
const THEME_STORAGE_KEY = '@kad/theme-preference/v1';

type PersistedState = {
  profile: UserProfile;
  answers: Record<string, AnswerRecord>;
  favoriteQuestionIds: string[];
  dailyQuestionUsage: DailyQuestionUsage;
  savedConcursos: string[];
  themePreference: ThemePreference;
};

type AppState = PersistedState & { subscription: Subscription };
type AppDataState = Omit<AppState, 'themePreference'>;

type StoredState = Omit<Partial<PersistedState>, 'profile'> & {
  profile?: Partial<UserProfile>;
};

const INITIAL_STATE: AppState = {
  profile: DEFAULT_PROFILE,
  subscription: DEFAULT_SUBSCRIPTION,
  answers: {},
  favoriteQuestionIds: [],
  dailyQuestionUsage: currentDailyUsage(),
  savedConcursos: [],
  themePreference: 'system',
};

type AppContextValue = AppDataState & {
  /** Falso até o estado salvo em disco ser carregado. */
  hydrated: boolean;
  performance: Performance;
  isPremium: boolean;
  dailyQuestionLimit: number;
  dailyQuestionsAnswered: number;
  dailyQuestionsRemaining: number;
  canViewStatistics: boolean;
  canUseSimulations: boolean;
  subscriptionLoading: boolean;
  canAnswerQuestion: (questionId: string) => boolean;
  answerQuestion: (question: Question, selected: AlternativeId) => void;
  resetQuestion: (questionId: string) => void;
  toggleFavoriteQuestion: (questionId: string) => void;
  resetProgress: () => void;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  subscribe: (
    plan: Exclude<SubscriptionPlan, 'basic'>,
    billingCycle: BillingCycle
  ) => Promise<SubscriptionActionResult>;
  cancelSubscription: () => Promise<SubscriptionActionResult>;
  refreshSubscription: () => Promise<void>;
  toggleSavedConcurso: (concursoId: string) => void;
  deleteAccount: () => Promise<void>;
};

type ThemeContextValue = {
  themePreference: ThemePreference;
  scheme: 'light' | 'dark';
  setThemePreference: (preference: ThemePreference) => void;
};

const AppContext = createContext<AppContextValue | null>(null);
const ThemeContext = createContext<ThemeContextValue | null>(null);

function stateForLocalStorage(state: AppDataState, authenticated: boolean): StoredState {
  const { subscription: _subscription, ...persistable } = state;
  if (!authenticated) return persistable;

  const { name, username, avatarUri } = state.profile;
  return {
    ...persistable,
    profile: { name, username, avatarUri },
  };
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function computePerformance(answers: Record<string, AnswerRecord>): Performance {
  const records = Object.values(answers);
  const total = records.length;
  const correct = records.filter((record) => record.isCorrect).length;

  const grouped = new Map<string, { total: number; correct: number }>();
  for (const record of records) {
    const current = grouped.get(record.subject) ?? { total: 0, correct: 0 };
    grouped.set(record.subject, {
      total: current.total + 1,
      correct: current.correct + (record.isCorrect ? 1 : 0),
    });
  }

  const bySubject = Array.from(grouped.entries())
    .map(([subject, value]) => ({
      subject,
      total: value.total,
      correct: value.correct,
      accuracy: value.total > 0 ? (value.correct / value.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    total,
    correct,
    wrong: total - correct,
    accuracy: total > 0 ? (correct / total) * 100 : 0,
    bySubject,
  };
}

function isoToday(): string {
  return new Date().toISOString();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const [subscriptionRefreshing, setSubscriptionRefreshing] = useState(false);
  const [subscriptionCheckedUserId, setSubscriptionCheckedUserId] = useState<string | null>(null);
  const subscriptionRequestRef = useRef(0);

  const userId = session?.user.id ?? null;
  const subscriptionOwnerRef = useRef(userId);
  subscriptionOwnerRef.current = userId;
  const authEmail = session?.user.email?.trim() ?? '';
  const metadataName = session?.user.user_metadata?.name;
  const metadataUsername = session?.user.user_metadata?.username;
  const authName =
    (typeof metadataName === 'string' && metadataName.trim()) ||
    authEmail.split('@')[0] ||
    DEFAULT_PROFILE.name;
  const authUsername =
    typeof metadataUsername === 'string' && metadataUsername.trim()
      ? metadataUsername.trim().toLowerCase()
      : undefined;
  const ownerId = userId ?? 'guest';
  const storageKey = authLoading ? null : `${STORAGE_KEY_PREFIX}:${ownerId}`;
  const hydrated = storageKey !== null && hydratedStorageKey === storageKey;
  const subscriptionLoading = subscriptionIsLoading({
    authLoading,
    userId,
    hydrated,
    checkedUserId: subscriptionCheckedUserId,
    refreshing: subscriptionRefreshing,
  });

  const refreshSubscription = useCallback(async () => {
    const requestId = ++subscriptionRequestRef.current;
    if (!userId) {
      setState((current) => ({ ...current, subscription: DEFAULT_SUBSCRIPTION }));
      setSubscriptionCheckedUserId(null);
      setSubscriptionRefreshing(false);
      return;
    }
    setSubscriptionRefreshing(true);
    try {
      const subscription = await loadRemoteSubscription(userId);
      if (
        subscriptionRequestRef.current === requestId &&
        subscriptionOwnerRef.current === userId
      ) {
        setState((current) => ({ ...current, subscription }));
      }
    } finally {
      if (
        subscriptionRequestRef.current === requestId &&
        subscriptionOwnerRef.current === userId
      ) {
        setSubscriptionCheckedUserId(userId);
        setSubscriptionRefreshing(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    subscriptionRequestRef.current += 1;
    setSubscriptionCheckedUserId(null);
    setSubscriptionRefreshing(false);
    setState((current) => ({ ...current, subscription: DEFAULT_SUBSCRIPTION }));
  }, [userId]);

  useEffect(() => {
    if (!storageKey) return;
    let active = true;

    setHydratedStorageKey(null);
    setState({
      ...INITIAL_STATE,
      profile: userId
        ? { ...INITIAL_STATE.profile, name: authName, email: authEmail, username: authUsername }
        : INITIAL_STATE.profile,
    });
    const fallbackKey = userId ? null : LEGACY_STORAGE_KEY;

    Promise.all([
      AsyncStorage.getItem(storageKey),
      fallbackKey ? AsyncStorage.getItem(fallbackKey) : Promise.resolve(null),
      AsyncStorage.getItem(THEME_STORAGE_KEY),
    ])
      .then(([scopedRaw, legacyRaw, storedTheme]) => {
        if (!active) return;
        const raw = scopedRaw ?? legacyRaw;
        const baseProfile: UserProfile = userId
          ? {
              ...INITIAL_STATE.profile,
              name: authName,
              email: authEmail,
              username: authUsername,
            }
          : INITIAL_STATE.profile;
        if (!raw) {
          setState({
            ...INITIAL_STATE,
            profile: baseProfile,
            themePreference: isThemePreference(storedTheme)
              ? storedTheme
              : INITIAL_STATE.themePreference,
          });
          return;
        }
        const parsed = JSON.parse(raw) as StoredState;
        const storedProfile = userId
          ? parsed.profile
          : sanitizeLegacyGuestProfile(parsed.profile);
        setState({
          profile: {
            ...baseProfile,
            ...storedProfile,
            ...(userId ? { email: authEmail } : {}),
          },
          subscription: DEFAULT_SUBSCRIPTION,
          answers: parsed.answers ?? {},
          favoriteQuestionIds: parsed.favoriteQuestionIds ?? [],
          dailyQuestionUsage: currentDailyUsage(parsed.dailyQuestionUsage),
          savedConcursos: parsed.savedConcursos ?? [],
          themePreference: isThemePreference(storedTheme)
            ? storedTheme
            : parsed.themePreference ?? 'system',
        });
      })
      .catch(() => {
        // Estado corrompido ou indisponível: seguimos com os valores padrão.
      })
      .finally(() => {
        if (active) setHydratedStorageKey(storageKey);
      });

    return () => {
      active = false;
    };
  }, [authEmail, authName, authUsername, storageKey, userId]);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    const storedState = stateForLocalStorage(
      {
        profile: state.profile,
        subscription: state.subscription,
        answers: state.answers,
        favoriteQuestionIds: state.favoriteQuestionIds,
        dailyQuestionUsage: state.dailyQuestionUsage,
        savedConcursos: state.savedConcursos,
      },
      Boolean(userId)
    );
    AsyncStorage.setItem(storageKey, JSON.stringify(storedState)).catch(() => {
      // Escrita falhou: o estado continua válido em memória nesta sessão.
    });
  }, [
    state.profile,
    state.answers,
    state.favoriteQuestionIds,
    state.dailyQuestionUsage,
    state.savedConcursos,
    hydrated,
    storageKey,
    userId,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(THEME_STORAGE_KEY, state.themePreference).catch(() => {
      // A preferência continua ativa em memória mesmo se a gravação local falhar.
    });
  }, [hydrated, state.themePreference]);

  useEffect(() => {
    if (!hydrated || !userId || !supabase) return;
    let active = true;

    Promise.all([
      supabase
        .from('profiles')
        .select('name, username, phone, city, target_role')
        .eq('id', userId)
        .maybeSingle(),
      loadRemoteStudyData(userId),
    ])
      .then(([profileResult, studyData]) => {
        if (!active) return;
        if (profileResult.error) throw profileResult.error;
        const data = profileResult.data;
        setState((current) => ({
          ...current,
          profile: data
            ? {
                ...current.profile,
                name: data.name || current.profile.name,
                email: authEmail,
                username: data.username || current.profile.username,
                phone: data.phone || undefined,
                city: data.city || undefined,
                targetRole: data.target_role || undefined,
              }
            : current.profile,
          answers: studyData.answers,
          favoriteQuestionIds: studyData.favoriteQuestionIds,
          savedConcursos: studyData.savedConcursos,
        }));
      })
      .catch(() => {
        // O cache local permanece disponível se a sincronização falhar.
      });

    return () => {
      active = false;
    };
  }, [authEmail, hydrated, userId]);

  useEffect(() => {
    if (!hydrated) return;
    refreshSubscription().catch(() => {
      // Sem confirmação do servidor, o plano Básico permanece como padrão seguro.
    });
  }, [hydrated, refreshSubscription]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    const subscription = ReactNativeAppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshSubscription().catch(() => {
          // Mantém o último estado confirmado quando a rede está indisponível.
        });
      }
    });
    return () => subscription.remove();
  }, [hydrated, refreshSubscription, userId]);

  useEffect(() => {
    const refreshTemporalState = () => {
      setState((current) => {
        const subscription = subscriptionWithCurrentStatus(current.subscription);
        const dailyQuestionUsage = currentDailyUsage(current.dailyQuestionUsage);
        if (
          subscription === current.subscription &&
          dailyQuestionUsage === current.dailyQuestionUsage
        ) {
          return current;
        }
        return { ...current, subscription, dailyQuestionUsage };
      });
    };

    refreshTemporalState();
    const interval = setInterval(refreshTemporalState, 60_000);
    const appStateSubscription = ReactNativeAppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshTemporalState();
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, []);

  const answerQuestion = useCallback((question: Question, selected: AlternativeId) => {
    setState((current) => {
      const usage = currentDailyUsage(current.dailyQuestionUsage);
      const alreadyCounted = usage.questionIds.includes(question.id);
      const hasUnlimitedQuestions = subscriptionHasVerifiedAccess({
        userId,
        loading: subscriptionLoading,
        subscription: current.subscription,
      });

      if (
        !hasUnlimitedQuestions &&
        !alreadyCounted &&
        usage.questionIds.length >= BASIC_DAILY_QUESTION_LIMIT
      ) {
        return current;
      }

      return {
        ...current,
        answers: {
          ...current.answers,
          [question.id]: {
            questionId: question.id,
            subject: question.subject,
            selected,
            isCorrect: selected === question.correct,
            answeredAt: isoToday(),
          },
        },
        dailyQuestionUsage: alreadyCounted
          ? usage
          : { ...usage, questionIds: [...usage.questionIds, question.id] },
      };
    });
    if (userId) saveRemoteAnswer(userId, question, selected).catch(() => {});
  }, [subscriptionLoading, userId]);

  const resetQuestion = useCallback((questionId: string) => {
    setState((current) => {
      if (!current.answers[questionId]) return current;
      const answers = { ...current.answers };
      delete answers[questionId];
      return { ...current, answers };
    });
    if (userId) removeRemoteAnswer(userId, questionId).catch(() => {});
  }, [userId]);

  const toggleFavoriteQuestion = useCallback((questionId: string) => {
    const favorite = !state.favoriteQuestionIds.includes(questionId);
    setState((current) => {
      const isFavorite = current.favoriteQuestionIds.includes(questionId);
      return {
        ...current,
        favoriteQuestionIds: isFavorite
          ? current.favoriteQuestionIds.filter((id) => id !== questionId)
          : [...current.favoriteQuestionIds, questionId],
      };
    });
    if (userId) {
      setRemoteFavorite(userId, questionId, favorite).catch(() => {
        setState((current) => ({
          ...current,
          favoriteQuestionIds: favorite
            ? current.favoriteQuestionIds.filter((id) => id !== questionId)
            : [...new Set([...current.favoriteQuestionIds, questionId])],
        }));
      });
    }
  }, [state.favoriteQuestionIds, userId]);

  const resetProgress = useCallback(() => {
    setState((current) => ({ ...current, answers: {} }));
    if (userId) removeRemoteAnswer(userId).catch(() => {});
  }, [userId]);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      const nextProfile = { ...state.profile, ...patch };
      if (userId && supabase) {
        const { error } = await supabase.from('profiles').upsert({
          id: userId,
          name: nextProfile.name,
          phone: nextProfile.phone ?? null,
          city: nextProfile.city ?? null,
          target_role: nextProfile.targetRole ?? null,
        });
        if (error) throw error;
      }

      setState((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
    },
    [state.profile, userId]
  );

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setState((current) =>
      current.themePreference === preference
        ? current
        : { ...current, themePreference: preference }
    );
  }, []);

  const subscribe = useCallback(
    (plan: Exclude<SubscriptionPlan, 'basic'>, billingCycle: BillingCycle) =>
      createSubscriptionCheckout(plan, billingCycle),
    []
  );

  const cancelSubscription = useCallback(async () => {
    const result = await cancelRemoteSubscription();
    if (result.ok) {
      setState((current) => ({
        ...current,
        subscription: subscriptionAfterCancellation(current.subscription),
      }));
      await refreshSubscription().catch(() => {
        // O cancelamento já foi confirmado; uma próxima sincronização reconcilia o estado.
      });
    }
    return result;
  }, [refreshSubscription]);

  const toggleSavedConcurso = useCallback((concursoId: string) => {
    const saved = !state.savedConcursos.includes(concursoId);
    setState((current) => {
      const alreadySaved = current.savedConcursos.includes(concursoId);
      return {
        ...current,
        savedConcursos: alreadySaved
          ? current.savedConcursos.filter((id) => id !== concursoId)
          : [...current.savedConcursos, concursoId],
      };
    });
    if (userId) {
      setRemoteSavedConcurso(userId, concursoId, saved).catch(() => {
        setState((current) => ({
          ...current,
          savedConcursos: saved
            ? current.savedConcursos.filter((id) => id !== concursoId)
            : [...new Set([...current.savedConcursos, concursoId])],
        }));
      });
    }
  }, [state.savedConcursos, userId]);

  const deleteAccount = useCallback(async () => {
    setState({ ...INITIAL_STATE });
    try {
      if (storageKey) await AsyncStorage.removeItem(storageKey);
      if (!userId) await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Nada a fazer: os dados locais já foram redefinidos em memória.
    }
  }, [storageKey, userId]);

  const performance = useMemo(() => computePerformance(state.answers), [state.answers]);
  const isPremium = subscriptionHasVerifiedAccess({
    userId,
    loading: subscriptionLoading,
    subscription: state.subscription,
  });
  const dailyUsage = currentDailyUsage(state.dailyQuestionUsage);
  const dailyQuestionsAnswered = dailyUsage.questionIds.length;
  const dailyQuestionsRemaining = Math.max(
    0,
    BASIC_DAILY_QUESTION_LIMIT - dailyQuestionsAnswered
  );

  const canAnswerQuestion = useCallback(
    (questionId: string) =>
      canAnswerWithDailyLimit({
        isPremium,
        usage: dailyUsage,
        questionId,
        limit: BASIC_DAILY_QUESTION_LIMIT,
      }),
    [dailyUsage, isPremium]
  );

  const systemScheme = useColorScheme();
  const scheme: 'light' | 'dark' =
    state.themePreference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : state.themePreference;

  const value = useMemo<AppContextValue>(
    () => ({
      profile: state.profile,
      subscription: state.subscription,
      answers: state.answers,
      favoriteQuestionIds: state.favoriteQuestionIds,
      dailyQuestionUsage: state.dailyQuestionUsage,
      savedConcursos: state.savedConcursos,
      hydrated,
      performance,
      isPremium,
      subscriptionLoading,
      dailyQuestionLimit: BASIC_DAILY_QUESTION_LIMIT,
      dailyQuestionsAnswered,
      dailyQuestionsRemaining,
      canViewStatistics: isPremium,
      canUseSimulations: isPremium,
      canAnswerQuestion,
      answerQuestion,
      resetQuestion,
      toggleFavoriteQuestion,
      resetProgress,
      updateProfile,
      subscribe,
      cancelSubscription,
      refreshSubscription,
      toggleSavedConcurso,
      deleteAccount,
    }),
    [
      state.profile,
      state.subscription,
      state.answers,
      state.favoriteQuestionIds,
      state.dailyQuestionUsage,
      state.savedConcursos,
      hydrated,
      performance,
      isPremium,
      subscriptionLoading,
      dailyQuestionsAnswered,
      dailyQuestionsRemaining,
      canAnswerQuestion,
      answerQuestion,
      resetQuestion,
      toggleFavoriteQuestion,
      resetProgress,
      updateProfile,
      subscribe,
      cancelSubscription,
      refreshSubscription,
      toggleSavedConcurso,
      deleteAccount,
    ]
  );

  const themeValue = useMemo<ThemeContextValue>(
    () => ({
      themePreference: state.themePreference,
      scheme,
      setThemePreference,
    }),
    [scheme, setThemePreference, state.themePreference]
  );

  return (
    <AppContext.Provider value={value}>
      <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp precisa ser usado dentro de AppProvider.');
  }
  return context;
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme precisa ser usado dentro de AppProvider.');
  }
  return context;
}
