import { localDay } from './utils.js';

export const STORAGE_KEY = 'kad-site/state/v1';

export const DEFAULT_STATE = Object.freeze({
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
});

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function mergeState(candidate) {
  const fallback = cloneDefault();
  if (!candidate || typeof candidate !== 'object' || candidate.version !== 1) return fallback;
  return {
    ...fallback,
    ...candidate,
    auth: { ...fallback.auth, ...candidate.auth },
    profile: { ...fallback.profile, ...candidate.profile },
    preferences: { ...fallback.preferences, ...candidate.preferences },
    subscription: { ...fallback.subscription, ...candidate.subscription },
    simulations: { ...fallback.simulations, ...candidate.simulations },
  };
}

function readStoredState(storage) {
  try {
    return mergeState(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return cloneDefault();
  }
}

export function createStore(storage = globalThis.localStorage) {
  let state = readStoredState(storage);
  const listeners = new Set();

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
    replace(next) {
      state = mergeState(next);
      persist();
      notify();
      return state;
    },
    update(recipe, { silent = false } = {}) {
      const draft = structuredClone(state);
      const returned = recipe(draft);
      state = mergeState(returned ?? draft);
      persist();
      if (!silent) notify();
      return state;
    },
    subscribe(listener) {
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

export function recordAnswer(draft, question, selected) {
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
