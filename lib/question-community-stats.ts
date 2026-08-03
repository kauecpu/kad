import { supabase } from '@/lib/supabase';
export { accuracyFromCounts } from '@/lib/accuracy';

export type CommunityAccuracy = {
  accuracy: number;
  totalAnswers: number;
};

export async function communityAccuracyForQuestion(
  questionId: string
): Promise<CommunityAccuracy | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('question_community_accuracy', {
    p_question_ids: [questionId],
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    accuracy: Number(row.accuracy),
    totalAnswers: Number(row.total_answers),
  };
}
