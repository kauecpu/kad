import { createStudySync, isStudyJournal } from '@/contracts/study-sync';
import { studyStorageKey } from '@/lib/local-user-data-keys';
import { protectedStorage } from '@/lib/protected-storage';
import { loadRemoteAnswers, removeRemoteAnswer, saveRemoteAnswer } from '@/lib/remote-user-data';

export function createAppStudySync() {
  return createStudySync({
    read: owner => protectedStorage.getItem(studyStorageKey(owner), owner, isStudyJournal),
    write: (owner, value) => protectedStorage.setItem(studyStorageKey(owner), owner, value),
    load: loadRemoteAnswers,
    send: (owner, mutation) => mutation.answer
      ? saveRemoteAnswer(owner, { id: mutation.questionId }, mutation.answer.selected)
      : removeRemoteAnswer(owner, mutation.questionId),
  });
}
