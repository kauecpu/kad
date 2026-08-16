import type { AdminFeedback, FeedbackStatus } from '../types';
import { supabase } from './supabase';

function asFeedbackList(value: unknown): AdminFeedback[] {
  if (!Array.isArray(value)) return [];
  return value as AdminFeedback[];
}

export async function loadAdminFeedback(): Promise<AdminFeedback[]> {
  if (!supabase) throw new Error('Supabase não configurado.');

  const { data, error } = await supabase.rpc('admin_list_user_feedback');
  if (error) throw error;
  return asFeedbackList(data);
}

export async function updateAdminFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');

  const { error } = await supabase.rpc('admin_update_user_feedback_status', {
    p_feedback_id: feedbackId,
    p_status: status,
  });
  if (error) throw error;
}
