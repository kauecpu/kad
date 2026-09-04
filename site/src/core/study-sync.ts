import { createStudySync } from '../../../contracts/study-sync.ts';
import { loadRemoteStudyAnswers, removeRemoteAnswer, saveRemoteAnswer } from '../services/supabase.ts';
export const studyJournalKey = (owner: string) => `kad-site/study-journal/v1/${encodeURIComponent(owner)}`;
export const studySync = createStudySync({
  read: async owner => globalThis.localStorage.getItem(studyJournalKey(owner)),
  write: async (owner, value) => { globalThis.localStorage.setItem(studyJournalKey(owner), value); },
  load: loadRemoteStudyAnswers,
  send: (owner, m) => m.answer
    ? saveRemoteAnswer(owner, m.questionId, m.answer.selected)
    : removeRemoteAnswer(owner, m.questionId),
});
