import { localDay } from './utils.js';

export const LEGACY_STORAGE_KEY = 'kad-site/state/v1';
export const STORAGE_KEY_PREFIX = 'kad-site/state/v2';

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

export function storageKeyForOwner(userId) {
  const owner = typeof userId === 'string' && userId.trim() ? `user:${userId.trim()}` : 'guest';
  return `${STORAGE_KEY_PREFIX}/${encodeURIComponent(owner)}`;
}

function parseStoredState(value) {
  try {
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null;
    return mergeState(parsed);
  } catch {
    return null;
  }
}

function readOwnerState(storage, userId) {
  const state = parseStoredState(storage?.getItem(storageKeyForOwner(userId))) ?? cloneDefault();
  state.auth = typeof userId === 'string' && userId.trim()
    ? { mode: 'authenticated', userId: userId.trim() }
    : { mode: 'visitor', userId: null };
  return state;
}

function migrateLegacyState(storage) {
  try {
    const legacyValue = storage?.getItem(LEGACY_STORAGE_KEY);
    const legacyState = parseStoredState(legacyValue);
    if (!legacyState || !legacyValue) return;
    const destination = storageKeyForOwner(legacyState.auth.userId);
    if (!storage.getItem(destination)) storage.setItem(destination, JSON.stringify(legacyState));
    const migrated = parseStoredState(storage.getItem(destination));
    if (migrated && JSON.stringify(migrated) === JSON.stringify(legacyState)) {
      storage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    // O valor antigo permanece intacto quando a migração é interrompida.
  }
}

export function createStore(storage = globalThis.localStorage, initialUserId = null) {
  migrateLegacyState(storage);
  let ownerId = initialUserId;
  let state = readOwnerState(storage, ownerId);
  const listeners = new Set();

  const persist = () => {
    try {
      storage?.setItem(storageKeyForOwner(ownerId), JSON.stringify(state));
    } catch {
      // A aplicação continua utilizável quando o navegador bloqueia armazenamento.
    }
  };

  const notify = () => listeners.forEach((listener) => listener(state));

  return {
    getState: () => state,
    getOwnerId: () => ownerId,
    switchOwner(userId) {
      ownerId = typeof userId === 'string' && userId.trim() ? userId.trim() : null;
      state = readOwnerState(storage, ownerId);
      notify();
      return state;
    },
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
        storage?.removeItem(storageKeyForOwner(ownerId));
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
