export type StudyAnswer = {
  questionId: string; subject: string; selected: 'A' | 'B' | 'C' | 'D' | 'E';
  isCorrect: boolean; answeredAt: string;
};
export type StudyMutation = { questionId: string; answer: StudyAnswer | null };
type Cache = { version: 1; answers: Record<string, StudyAnswer>; pending: StudyMutation[] };
export type StudySyncState = {
  owner: string | null; answers: Record<string, StudyAnswer>; ready: boolean;
  pending: number; status: 'loading' | 'local' | 'saved' | 'pending' | 'unavailable';
  storageError: boolean;
};
type Dependencies = {
  read(owner: string): Promise<string | null>;
  write(owner: string, value: string): Promise<void>;
  load(owner: string): Promise<Record<string, StudyAnswer>>;
  send(owner: string, mutation: StudyMutation): Promise<void>;
};
const blank = (): Cache => ({ version: 1, answers: {}, pending: [] });
function validAnswer(value: unknown): value is StudyAnswer {
  if (!value || typeof value !== 'object') return false;
  const a = value as StudyAnswer;
  return typeof a.questionId === 'string' && a.questionId.length > 0
    && typeof a.subject === 'string' && ['A', 'B', 'C', 'D', 'E'].includes(a.selected)
    && typeof a.isCorrect === 'boolean' && Number.isFinite(Date.parse(a.answeredAt));
}
function parse(raw: string): Cache {
  const c = JSON.parse(raw) as Cache;
  if (c.version !== 1 || !c.answers || Array.isArray(c.answers) || !Array.isArray(c.pending)
    || !Object.entries(c.answers).every(([id, a]) => validAnswer(a) && id === a.questionId)
    || !c.pending.every(m => typeof m.questionId === 'string' && (m.answer === null
      || (validAnswer(m.answer) && m.questionId === m.answer.questionId)))) throw new Error('Invalid study cache');
  return c;
}
export function isStudyJournal(raw: string): boolean {
  try { parse(raw); return true; } catch { return false; }
}

/** Per-account write-ahead journal. No network response may cross an owner generation. */
export function createStudySync(deps: Dependencies) {
  let owner: string | null = null;
  let generation = 0;
  let revision = 0;
  let cache = blank();
  let ready = Promise.resolve();
  let writes = Promise.resolve();
  let task: { generation: number; promise: Promise<void> } | null = null;
  let state: StudySyncState = { owner, answers: {}, ready: false, pending: 0, status: 'loading', storageError: false };
  const listeners = new Set<() => void>();
  const emit = (status: StudySyncState['status'], storageError = state.storageError) => {
    state = { ...state, owner, answers: cache.answers, pending: cache.pending.length, status, storageError };
    listeners.forEach(fn => fn());
  };
  const persist = async (gen: number) => {
    const key = owner ?? 'guest';
    const value = JSON.stringify(cache);
    const write = writes.catch(() => {}).then(() => deps.write(key, value));
    writes = write;
    try { await write; if (gen === generation && state.storageError) emit(state.status, false); }
    catch { if (gen === generation) emit('unavailable', true); throw new Error('Study storage unavailable'); }
  };
  const sync = (): Promise<void> => {
    const gen = generation;
    if (task?.generation === gen) return task.promise;
    const promise = (async () => {
      await ready;
      if (gen !== generation || !state.ready || !owner) return;
      const account = owner;
      try {
        // A previous disk failure must be repaired before sending anything.
        await persist(gen);
        while (gen === generation) {
          while (cache.pending.length && gen === generation) {
            const mutation = cache.pending[0];
            await deps.send(account, mutation);
            if (gen !== generation) return;
            cache.pending = cache.pending.filter(item => item !== mutation);
            await persist(gen);
          }
          if (gen !== generation) return;
          const loadedRevision = revision;
          const remote = await deps.load(account);
          if (gen !== generation) return;
          if (!Object.entries(remote).every(([id, a]) => validAnswer(a) && a.questionId === id)) throw new Error('Invalid study response');
          // A new answer/reset during the read invalidates that snapshot.
          if (loadedRevision === revision) {
            cache.answers = remote;
            await persist(gen);
          }
          if (!cache.pending.length) break;
        }
        if (gen === generation) emit('saved');
      } catch { if (gen === generation) emit('unavailable'); }
    })();
    task = { generation: gen, promise };
    void promise.finally(() => { if (task?.promise === promise) task = null; });
    return promise;
  };
  const changed = () => {
    revision++;
    const gen = generation;
    emit('pending');
    void persist(gen).then(() => {
      if (gen !== generation) return;
      if (owner) void sync();
      else emit('local');
    }).catch(() => {});
  };
  return {
    getState: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async selectOwner(next: string | null, legacy: Record<string, StudyAnswer> = {}) {
      const gen = ++generation;
      owner = next; revision++; cache = blank(); state = { ...state, ready: false }; emit('loading', false);
      ready = (async () => {
        try {
          await writes.catch(() => {});
          const raw = await deps.read(next ?? 'guest');
          if (gen !== generation) return;
          cache = raw ? parse(raw) : { ...blank(), answers: Object.fromEntries(Object.entries(legacy).filter(([id, a]) => validAnswer(a) && a.questionId === id)) };
          state = { ...state, ready: true };
          emit(next ? 'pending' : 'local');
        } catch { if (gen === generation) emit('unavailable', true); }
      })();
      await ready;
      // Network work never delays owner selection or login navigation.
      if (gen === generation && state.ready && next) void sync();
    },
    answer(answer: StudyAnswer): boolean {
      if (!state.ready || !validAnswer(answer) || cache.answers[answer.questionId]) return false;
      cache.answers = { ...cache.answers, [answer.questionId]: answer };
      if (owner) cache.pending.push({ questionId: answer.questionId, answer });
      changed();
      return true;
    },
    reset(questionId?: string) {
      if (!state.ready) return;
      const ids = questionId ? [questionId] : Object.keys(cache.answers);
      cache.answers = { ...cache.answers };
      for (const id of ids) {
        delete cache.answers[id];
        if (owner) cache.pending.push({ questionId: id, answer: null });
      }
      changed();
    },
    sync,
    async flush() { await writes.catch(() => {}); },
    invalidate() {
      generation++; revision++; cache = blank();
      state = { ...state, ready: false };
      emit('loading', false);
    },
    dispose() { generation++; listeners.clear(); },
  };
}

export function studySyncMessage(state: Pick<StudySyncState, 'status' | 'storageError'>): string {
  if (state.storageError) return 'Não foi possível salvar neste aparelho. Mantenha a tela aberta e tente novamente.';
  if (state.status === 'loading') return 'Carregando seu progresso…';
  if (state.status === 'local') return 'Progresso salvo neste aparelho.';
  if (state.status === 'saved') return 'Progresso sincronizado com sua conta.';
  if (state.status === 'unavailable') return 'Progresso local preservado. Entre na conta ou tente sincronizar novamente.';
  return 'Progresso neste aparelho; sincronização pendente.';
}
