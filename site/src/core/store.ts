import { localDay } from './utils.ts';
import type { AlternativeId, Question, SiteState, StorageLike, Store } from '../types/domain.ts';

export const STORAGE_KEY = 'kad-site/state/v1';

export const DEFAULT_STATE: Readonly<SiteState> = Object.freeze({
  version: 1,
  auth: { mode: 'visitor', userId: null },
  profile: {
    name: 'Visitante',
    email: '',
    username: '@visitante',
    phone: '',
    city: '',
    targetRole: '',
  },
  preferences: {
    theme: 'system',
    weeklyGoal: 30,
    hasStarted: false,
  },
  subscription: {
    plan: 'basic',
    status: 'inactive',
    autoRenew: false,
  },
  answers: {},
  favorites: [],
  savedConcursos: [],
  comments: {},
  simulations: { current: null, history: [] },
  essays: {},
  trail: null,
  feedback: [],
  activityByDate: {},
} satisfies SiteState);

function cloneDefault(): SiteState {
  return structuredClone(DEFAULT_STATE);
}

function mergeState(candidate: unknown): SiteState {
  const fallback = cloneDefault();
  if (!candidate || typeof candidate !== 'object' || !('version' in candidate) || candidate.version !== 1) return fallback;
  const partial = candidate as Partial<SiteState>;
  return {
    ...fallback,
    ...partial,
    version: 1,
    auth: { ...fallback.auth, ...partial.auth },
    profile: { ...fallback.profile, ...partial.profile },
    preferences: { ...fallback.preferences, ...partial.preferences },
    subscription: { ...fallback.subscription, ...partial.subscription },
    simulations: { ...fallback.simulations, ...partial.simulations },
  };
}

function readStoredState(storage?: StorageLike): SiteState {
  try {
    return mergeState(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return cloneDefault();
  }
}

export function createStore(storage: StorageLike | undefined = globalThis.localStorage): Store {
  let state = readStoredState(storage);
  const listeners = new Set<(state: SiteState) => void>();

  const persist = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // A aplicação continua utilizável quando o navegador bloqueia armazenamento.
    }
  };

  const notify = () => listeners.forEach((listener) => listener(state));

  return {
    getState: () => state,
    replace(next: unknown) {
      state = mergeState(next);
      persist();
      notify();
      return state;
    },
    update(recipe: (draft: SiteState) => SiteState | void, { silent = false } = {}) {
      const draft = structuredClone(state);
      const returned = recipe(draft);
      state = mergeState(returned ?? draft);
      persist();
      if (!silent) notify();
      return state;
    },
    subscribe(listener: (state: SiteState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      state = cloneDefault();
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        // Sem ação: o estado em memória já foi limpo.
      }
      notify();
      return state;
    },
  };
}

export function recordAnswer(draft: SiteState, question: Question, selected: AlternativeId): void {
  const answeredAt = new Date().toISOString();
  draft.answers[question.id] = {
    questionId: question.id,
    subject: question.subject,
    selected,
    isCorrect: selected === question.correct,
    answeredAt,
  };
  const day = localDay(new Date(answeredAt));
  const ids = new Set(draft.activityByDate[day] ?? []);
  ids.add(question.id);
  draft.activityByDate[day] = [...ids];
}

export const store = createStore();
