import type {
  AdminQuestion,
  QuestionPublicationAction,
  QuestionPublicationPreview,
  QuestionPublicationResult,
} from '../types';
import { adminSupabaseProjectRef, supabase } from './supabase';

export async function loadAdminQuestions(): Promise<AdminQuestion[]> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.rpc('admin_list_questions');
  if (error) throw error;
  return Array.isArray(data) ? data as AdminQuestion[] : [];
}

export async function saveAdminQuestion(question: AdminQuestion): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.rpc('admin_save_question', { p_question: question });
  if (error) throw error;
}

export async function previewQuestionPublication(
  questionIds: string[],
  action: QuestionPublicationAction,
): Promise<QuestionPublicationPreview> {
  if (!supabase || !adminSupabaseProjectRef) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.rpc('admin_preview_question_publication', {
    p_question_ids: questionIds,
    p_action: action,
    p_expected_project_ref: adminSupabaseProjectRef,
  });
  if (error) throw error;
  return data as QuestionPublicationPreview;
}

export async function applyQuestionPublication(
  questionIds: string[],
  action: QuestionPublicationAction,
  previewFingerprint: string,
): Promise<QuestionPublicationResult> {
  if (!supabase || !adminSupabaseProjectRef) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.rpc('admin_apply_question_publication', {
    p_question_ids: questionIds,
    p_action: action,
    p_expected_project_ref: adminSupabaseProjectRef,
    p_preview_fingerprint: previewFingerprint,
  });
  if (error) throw error;
  return data as QuestionPublicationResult;
}
