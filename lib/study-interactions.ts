export type StudyOptionState = 'idle' | 'selected' | 'correct' | 'incorrect' | 'muted';

export type StudyOptionStateInput = {
  selected: boolean;
  answered: boolean;
  correct: boolean;
};

export function studyOptionInstanceKey(questionId: string, alternativeId: string): string {
  return `${questionId}:${alternativeId}`;
}

export function resolveStudyOptionState({
  selected,
  answered,
  correct,
}: StudyOptionStateInput): StudyOptionState {
  if (!answered) return selected ? 'selected' : 'idle';
  if (correct) return 'correct';
  if (selected) return 'incorrect';
  return 'muted';
}

export type StudyActionGate = {
  tryEnter: () => boolean;
  reset: () => void;
};

/** Impede que dois eventos do mesmo gesto alterem o estado antes do próximo render. */
export function createStudyActionGate(): StudyActionGate {
  let active = false;

  return {
    tryEnter() {
      if (active) return false;
      active = true;
      return true;
    },
    reset() {
      active = false;
    },
  };
}

type PerformStudyActionOptions = {
  gate: StudyActionGate;
  commit: () => void;
  feedback?: () => void | Promise<unknown>;
};

/**
 * Confirma o dado primeiro. Feedback visual ou tátil é complementar e nunca
 * bloqueia a persistência ou a próxima navegação.
 */
export function performStudyAction({
  gate,
  commit,
  feedback,
}: PerformStudyActionOptions): boolean {
  if (!gate.tryEnter()) return false;

  commit();
  if (feedback) {
    try {
      void Promise.resolve(feedback()).catch(() => {});
    } catch {
      // O dado já foi confirmado; feedback complementar falha de forma silenciosa.
    }
  }
  return true;
}
