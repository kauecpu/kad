import { supabase } from '@/lib/supabase';
import { ownedStudyRequest } from '@/contracts/study-request';
import type { AnswerRecord, Question } from '@/types';

export type RemoteStudyData = {
  answers: Record<string, AnswerRecord>;
  favoriteQuestionIds: string[];
  savedConcursos: string[];
};

export async function loadRemoteAnswers(userId: string): Promise<Record<string, AnswerRecord>> {
  const client = supabase;
  if (!client) throw new Error('Study unavailable');
  const { data, error } = await ownedStudyRequest(userId, client.auth, (authorization, signal) => client
    .from('question_attempts').select('question_id, subject, selected, is_correct, answered_at')
    .eq('user_id', userId).setHeader('Authorization', authorization).abortSignal(signal));
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(a => [a.question_id, {
    questionId: a.question_id, subject: a.subject, selected: a.selected as AnswerRecord['selected'],
    isCorrect: a.is_correct, answeredAt: a.answered_at,
  }]));
}

export async function loadRemoteStudyData(userId: string): Promise<RemoteStudyData> {
  if (!supabase) return { answers: {}, favoriteQuestionIds: [], savedConcursos: [] };

  const [attemptsResult, favoritesResult, concursosResult] = await Promise.all([
    supabase
      .from('question_attempts')
      .select('question_id, subject, selected, is_correct, answered_at')
      .eq('user_id', userId),
    supabase
      .from('question_favorites')
      .select('question_id')
      .eq('user_id', userId),
    supabase
      .from('saved_concursos')
      .select('concurso_id')
      .eq('user_id', userId),
  ]);

  const error = attemptsResult.error ?? favoritesResult.error ?? concursosResult.error;
  if (error) throw error;

  const answers = Object.fromEntries(
    (attemptsResult.data ?? []).map((attempt) => [
      attempt.question_id,
      {
        questionId: attempt.question_id,
        subject: attempt.subject,
        selected: attempt.selected as AnswerRecord['selected'],
        isCorrect: attempt.is_correct,
        answeredAt: attempt.answered_at,
      },
    ])
  );

  return {
    answers,
    favoriteQuestionIds: (favoritesResult.data ?? []).map((item) => item.question_id),
    savedConcursos: (concursosResult.data ?? []).map((item) => item.concurso_id),
  };
}

export async function saveRemoteAnswer(userId: string, question: Pick<Question, 'id'>, selected: string) {
  const client = supabase;
  if (!client) throw new Error('Study unavailable');
  const { error } = await ownedStudyRequest(userId, client.auth, (authorization, signal) =>
    client.rpc('record_question_attempt', {
      p_question_id: question.id,
      p_selected: selected,
    }).setHeader('Authorization', authorization).abortSignal(signal));
  if (error) throw error;
}

export async function removeRemoteAnswer(userId: string, questionId?: string) {
  const client = supabase;
  if (!client) throw new Error('Study unavailable');
  const { error } = await ownedStudyRequest(userId, client.auth, (authorization, signal) => {
    let query = client.from('question_attempts').delete().eq('user_id', userId);
    if (questionId) query = query.eq('question_id', questionId);
    return query.setHeader('Authorization', authorization).abortSignal(signal);
  });
  if (error) throw error;
}

export async function setRemoteFavorite(
  userId: string,
  questionId: string,
  favorite: boolean
) {
  if (!supabase) return;
  const result = favorite
    ? await supabase
        .from('question_favorites')
        .upsert({ user_id: userId, question_id: questionId })
    : await supabase
        .from('question_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('question_id', questionId);
  if (result.error) throw result.error;
}

export async function setRemoteSavedConcurso(
  userId: string,
  concursoId: string,
  saved: boolean
) {
  if (!supabase) return;
  const result = saved
    ? await supabase.from('saved_concursos').upsert({ user_id: userId, concurso_id: concursoId })
    : await supabase
        .from('saved_concursos')
        .delete()
        .eq('user_id', userId)
        .eq('concurso_id', concursoId);
  if (result.error) throw result.error;
}
