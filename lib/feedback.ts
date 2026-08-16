import { supabase } from '@/lib/supabase';
import { validateFeedbackDraft, type FeedbackDraft } from '@/lib/feedback-rules';

export * from '@/lib/feedback-rules';

export async function submitFeedback(draft: FeedbackDraft) {
  const validated = validateFeedbackDraft(draft);
  if (!validated.ok) return validated;
  if (!supabase) {
    return { ok: false as const, message: 'O envio ainda não está configurado neste ambiente.' };
  }

  const { error } = await supabase.rpc('submit_user_feedback', {
    p_category: validated.value.category,
    p_message: validated.value.message,
    p_source_screen: validated.value.sourceScreen,
    p_platform: validated.value.platform,
    p_app_version: validated.value.appVersion ?? null,
  });

  if (!error) return { ok: true as const };
  if (error.message.includes('Feedback rate limit exceeded')) {
    return {
      ok: false as const,
      message: 'Você já enviou algumas mensagens recentemente. Tente novamente mais tarde.',
    };
  }
  if (error.code === '42501') {
    return { ok: false as const, message: 'Sua sessão expirou. Entre novamente para enviar.' };
  }
  return {
    ok: false as const,
    message: 'Não foi possível enviar agora. Confira sua conexão e tente novamente.',
  };
}
