import { MIN_PASSWORD_LENGTH } from './auth-security.ts';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  weak_password: `Use uma senha mais forte, com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  over_email_send_rate_limit: 'Aguarde um momento antes de solicitar outro e-mail.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde um momento e tente novamente.',
  otp_expired: 'Código inválido ou expirado. Solicite um novo código.',
  otp_disabled: 'A confirmação por código está temporariamente indisponível.',
  same_password: 'A nova senha deve ser diferente da senha atual.',
  reauthentication_needed: 'Confirme sua identidade antes de alterar a senha.',
  reauthentication_not_valid: 'A confirmação da sua identidade não é mais válida.',
  request_timeout: 'A conexão demorou demais. Verifique sua internet e tente novamente.',
  signup_disabled: 'Novos cadastros estão temporariamente indisponíveis.',
};

export function authErrorMessage(error: { code?: string; message?: string } | null): string {
  if (!error) return 'Não foi possível concluir a operação.';
  if (error.code && AUTH_ERROR_MESSAGES[error.code]) return AUTH_ERROR_MESSAGES[error.code];

  const message = error.message?.toLocaleLowerCase('en-US') ?? '';
  if (message.includes('invalid login credentials')) return AUTH_ERROR_MESSAGES.invalid_credentials;
  if (message.includes('email not confirmed')) return AUTH_ERROR_MESSAGES.email_not_confirmed;
  if (message.includes('already registered')) return AUTH_ERROR_MESSAGES.user_already_exists;

  return 'Não foi possível concluir a operação. Tente novamente.';
}
