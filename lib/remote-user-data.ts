import { supabase } from '@/lib/supabase';
import type { AnswerRecord, Question } from '@/types';

export type RemoteStudyData = {
  answers: Record<string, AnswerRecord>;
  favoriteQuestionIds: string[];
  savedConcursos: string[];
};

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

export async function saveRemoteAnswer(userId: string, question: Question, selected: string) {
  if (!supabase) return;
  const { error } = await supabase.from('question_attempts').upsert(
    {
      user_id: userId,
      question_id: question.id,
      subject: question.subject,
      selected,
      is_correct: selected === question.correct,
      answered_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,question_id' }
  );
  if (error) throw error;
}

export async function removeRemoteAnswer(userId: string, questionId?: string) {
  if (!supabase) return;
  let query = supabase.from('question_attempts').delete().eq('user_id', userId);
  if (questionId) query = query.eq('question_id', questionId);
  const { error } = await query;
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
