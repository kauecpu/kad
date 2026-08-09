import type { AdminQuestion } from '../types';
import { supabase } from './supabase';

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
