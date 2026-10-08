export type RecoveryFailure =
  | 'invalid-link' | 'interrupted' | 'expired' | 'expired-or-used'
  | 'session-missing' | 'session-mismatch' | 'network' | 'rate-limit'
  | 'recent-request' | 'weak-password' | 'same-password' | 'technical' | 'captcha';

export function recoveryFailure(error: unknown): RecoveryFailure {
  const value = error && typeof error === 'object' ? error as { code?: string; name?: string; status?: number } : {};
  switch (value.code) {
    case 'captcha_failed': return 'captcha';
    case 'pkce_code_verifier_not_found':
    case 'session_not_found':
    case 'session_expired': return 'session-missing';
    case 'bad_code_verifier': return 'session-mismatch';
    case 'flow_state_expired': return 'expired';
    // The provider uses these codes for more than one condition. Do not claim reuse alone.
    case 'otp_expired':
    case 'flow_state_not_found': return 'expired-or-used';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'rate-limit';
    case 'weak_password': return 'weak-password';
    case 'same_password': return 'same-password';
    case 'request_timeout': return 'network';
  }
  if (value.status === 429) return 'rate-limit';
  if (value.name === 'AuthPKCECodeVerifierMissingError') return 'session-missing';
  if (value.name === 'AuthRetryableFetchError'
    || (error instanceof TypeError && /fetch|network|load failed/i.test(error.message))) return 'network';
  return 'technical';
}

const messages: Record<RecoveryFailure, { title: string; message: string }> = {
  captcha: { title: 'Verificação de segurança', message: 'Não foi possível concluir a verificação de segurança. Tente novamente.' },
  'invalid-link': { title: 'Link incompleto ou inválido', message: 'Este endereço não contém os dados necessários. Abra o link completo do e-mail de recuperação.' },
  interrupted: { title: 'Recuperação não validada nesta página', message: 'Se você atualizou ou fechou a página após validar o link, a autorização para trocar a senha foi encerrada. Inicie uma nova recuperação.' },
  expired: { title: 'Link expirado', message: 'O prazo deste link terminou. Solicite um novo e-mail de recuperação.' },
  'expired-or-used': { title: 'Link expirado ou já utilizado', message: 'O serviço não aceitou este link. Ele pode ter expirado ou já ter sido utilizado. Solicite um novo e-mail de recuperação.' },
  'session-missing': { title: 'Sessão de recuperação ausente', message: 'Não encontramos a confirmação local desta recuperação. Abra o link no mesmo navegador e endereço em que pediu o e-mail. Se a sessão foi apagada, inicie uma nova recuperação.' },
  'session-mismatch': { title: 'Sessão não corresponde ao link', message: 'Este link não corresponde à recuperação iniciada neste navegador. Inicie uma nova recuperação aqui.' },
  network: { title: 'Falha de conexão', message: 'Não foi possível confirmar a operação com o serviço. Confira sua conexão. Se o link já foi aberto, uma nova recuperação pode ser necessária; não envie pedidos repetidos.' },
  'rate-limit': { title: 'Limite de envio atingido', message: 'O serviço limitou novas solicitações. Aguarde a liberação antes de tentar novamente. Esta tentativa não enviou um novo e-mail.' },
  'recent-request': { title: 'Solicitação recente', message: 'Já houve uma solicitação há menos de um minuto neste navegador. Confira seu e-mail ou aguarde antes de tentar novamente.' },
  'weak-password': { title: 'Escolha outra senha', message: 'A senha não atende aos requisitos de segurança. Use uma senha mais forte.' },
  'same-password': { title: 'Escolha uma senha diferente', message: 'A nova senha deve ser diferente da anterior.' },
  technical: { title: 'Não foi possível concluir', message: 'O serviço encontrou uma falha ao confirmar a operação. Tente novamente mais tarde. Isso não confirma que o link expirou.' },
};

export function recoveryMessage(reason: string | undefined) {
  return messages[reason as RecoveryFailure] ?? messages.technical;
}

type RequestResult = { ok: true } | { ok: false; reason: RecoveryFailure };

/** Coalesces clicks/renders without retries or storing email addresses or PKCE material. */
export function createRecoveryRequest(
  send: (email: string) => Promise<{ error: unknown }>,
  now: () => number = Date.now,
) {
  let pending: Promise<RequestResult> | null = null;
  let availableAt = 0;
  return (email: string): Promise<RequestResult> => {
    if (pending) return pending;
    if (now() < availableAt) return Promise.resolve({ ok: false, reason: 'recent-request' });
    pending = (async (): Promise<RequestResult> => {
      try {
        const { error } = await send(email);
        if (!error) {
          availableAt = now() + 60_000;
          return { ok: true };
        }
        const reason = recoveryFailure(error);
        if (reason === 'rate-limit') availableAt = now() + 60_000;
        return { ok: false, reason };
      } catch (error) {
        return { ok: false, reason: recoveryFailure(error) };
      }
    })().finally(() => { pending = null; });
    return pending;
  };
}
