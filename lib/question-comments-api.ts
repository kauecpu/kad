import { supabase } from '@/lib/supabase';

export type QuestionComment = {
  id: string;
  userId: string;
  author: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  likes: number;
  likedByMe: boolean;
  isOwn: boolean;
};

type CommentRow = {
  id: string;
  user_id: string;
  author_name: string;
  text: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
};

function mapComment(row: CommentRow, userId: string, likedIds: Set<string>): QuestionComment {
  return {
    id: row.id,
    userId: row.user_id,
    author: row.author_name,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at !== row.created_at ? row.updated_at : undefined,
    likes: row.likes_count,
    likedByMe: likedIds.has(row.id),
    isOwn: row.user_id === userId,
  };
}

export async function loadQuestionComments(questionId: string, userId: string) {
  if (!supabase) return [];
  const commentsResult = await supabase
    .from('question_comments')
    .select('id, user_id, author_name, text, likes_count, created_at, updated_at')
    .eq('question_id', questionId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (commentsResult.error) throw commentsResult.error;
  if (!commentsResult.data?.length) return [];

  const likesResult = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('user_id', userId)
    .in('comment_id', commentsResult.data.map((comment) => comment.id));
  if (likesResult.error) throw likesResult.error;
  const likedIds = new Set((likesResult.data ?? []).map((item) => item.comment_id));
  return (commentsResult.data ?? []).map((row) =>
    mapComment(row as CommentRow, userId, likedIds)
  );
}

export async function createQuestionComment({
  questionId,
  userId,
  author,
  text,
}: {
  questionId: string;
  userId: string;
  author: string;
  text: string;
}) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('question_comments')
    .insert({ question_id: questionId, user_id: userId, author_name: author, text })
    .select('id, user_id, author_name, text, likes_count, created_at, updated_at')
    .single();
  if (error) throw error;
  return mapComment(data as CommentRow, userId, new Set());
}

export async function updateQuestionComment(commentId: string, userId: string, text: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('question_comments')
    .update({ text })
    .eq('id', commentId)
    .eq('user_id', userId)
    .select('id, user_id, author_name, text, likes_count, created_at, updated_at')
    .single();
  if (error) throw error;
  return data as CommentRow;
}

export async function deleteQuestionComment(commentId: string, userId: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase
    .from('question_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setQuestionCommentLiked(
  commentId: string,
  userId: string,
  liked: boolean
) {
  if (!supabase) throw new Error('Supabase is not configured');
  const result = liked
    ? await supabase.from('comment_likes').upsert({ comment_id: commentId, user_id: userId })
    : await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);
  if (result.error) throw result.error;
}
