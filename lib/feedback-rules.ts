export const FEEDBACK_MIN_LENGTH = 3;
export const FEEDBACK_MAX_LENGTH = 2000;

export const FEEDBACK_CATEGORIES = [
  { value: 'suggestion', label: 'Sugestão', icon: 'bulb-outline' },
  { value: 'problem', label: 'Problema', icon: 'warning-outline' },
  { value: 'question', label: 'Dúvida', icon: 'help-circle-outline' },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]['value'];
export type FeedbackPlatform = 'android' | 'ios' | 'web' | 'unknown';

export type FeedbackDraft = {
  category: FeedbackCategory;
  message: string;
  sourceScreen: string;
  platform: FeedbackPlatform;
  appVersion?: string;
};

export type FeedbackValidation =
  | { ok: true; value: FeedbackDraft }
  | { ok: false; message: string };

export function validateFeedbackDraft(draft: FeedbackDraft): FeedbackValidation {
  const message = draft.message.trim();
  if (message.length < FEEDBACK_MIN_LENGTH) {
    return { ok: false, message: 'Conte um pouco mais para conseguirmos entender.' };
  }
  if (message.length > FEEDBACK_MAX_LENGTH) {
    return {
      ok: false,
      message: `O comentário deve ter no máximo ${FEEDBACK_MAX_LENGTH} caracteres.`,
    };
  }

  return {
    ok: true,
    value: {
      ...draft,
      message,
      sourceScreen: draft.sourceScreen.trim().slice(0, 120) || 'unknown',
      appVersion: draft.appVersion?.trim().slice(0, 40) || undefined,
    },
  };
}
