import {
  type AuthEmailActionType,
  type AuthEmailHookPayload,
  AuthEmailInputError,
} from './auth-email-contract.ts';
import {
  type AuthEmailRuntimeConfig,
  isAllowedAuthRedirect,
} from './auth-email-config.ts';

export type AuthEmailRecipientRole = 'primary' | 'current_email' | 'new_email';

export type AuthEmailMessagePlan = {
  actionType: AuthEmailActionType;
  recipientRole: AuthEmailRecipientRole;
  to: string;
  subject: string;
  preview: string;
  title: string;
  introduction: string;
  safetyNotice: string;
  token?: string;
  tokenHash?: string;
  actionUrl?: string;
  actionLabel?: string;
};

const ACTION_SAFETY_NOTICE = 'Se você não solicitou esta ação, ignore este e-mail e não compartilhe o código ou o link.';
const SECURITY_SAFETY_NOTICE = 'Se você não reconhece esta alteração, redefina sua senha e revise os acessos à sua conta.';
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const BRAND_DELIMITER = /[<>"\\,;]/;

type Copy = {
  subjectSuffix: string;
  title: string;
  introduction: string;
  actionLabel?: string;
  includesToken?: boolean;
  includesLink?: boolean;
};

const ACTION_COPY: Record<Exclude<AuthEmailActionType, 'email_change' | `${string}_notification`>, Copy> = {
  signup: {
    subjectSuffix: 'confirme seu e-mail',
    title: 'Confirme seu e-mail',
    introduction: 'Digite este código para confirmar seu e-mail.',
    includesToken: true,
  },
  email: {
    subjectSuffix: 'seu código de acesso',
    title: 'Acesse sua conta',
    introduction: 'Digite este código para acessar sua conta.',
    includesToken: true,
  },
  recovery: {
    subjectSuffix: 'redefina sua senha',
    title: 'Redefina sua senha',
    introduction: 'Use o link abaixo para criar uma nova senha.',
    actionLabel: 'Criar nova senha',
    includesLink: true,
  },
  magiclink: {
    subjectSuffix: 'seu link de acesso',
    title: 'Acesse sua conta',
    introduction: 'Use o código ou o link abaixo para acessar sua conta.',
    actionLabel: 'Entrar na conta',
    includesToken: true,
    includesLink: true,
  },
  invite: {
    subjectSuffix: 'você recebeu um convite',
    title: 'Aceite seu convite',
    introduction: 'Use o link abaixo para aceitar seu convite.',
    actionLabel: 'Aceitar convite',
    includesLink: true,
  },
  reauthentication: {
    subjectSuffix: 'confirme esta ação',
    title: 'Confirme sua identidade',
    introduction: 'Digite este código para confirmar sua identidade.',
    includesToken: true,
  },
};

type DeliverableNotificationAction = Exclude<
  Extract<AuthEmailActionType, `${string}_notification`>,
  'identity_unlinked_notification'
>;

const NOTIFICATION_COPY: Record<DeliverableNotificationAction, Copy> = {
  password_changed_notification: {
    subjectSuffix: 'sua senha foi alterada',
    title: 'Senha alterada',
    introduction: 'A senha da sua conta foi alterada.',
  },
  email_changed_notification: {
    subjectSuffix: 'seu e-mail foi alterado',
    title: 'E-mail alterado',
    introduction: 'O e-mail da sua conta foi alterado.',
  },
  phone_changed_notification: {
    subjectSuffix: 'seu telefone foi alterado',
    title: 'Telefone alterado',
    introduction: 'O telefone da sua conta foi alterado.',
  },
  identity_linked_notification: {
    subjectSuffix: 'novo acesso vinculado',
    title: 'Identidade vinculada',
    introduction: 'Um novo acesso foi vinculado à sua conta.',
  },
  mfa_factor_enrolled_notification: {
    subjectSuffix: 'verificação em duas etapas ativada',
    title: 'Fator de segurança adicionado',
    introduction: 'Um fator de segurança foi adicionado à sua conta.',
  },
  mfa_factor_unenrolled_notification: {
    subjectSuffix: 'verificação em duas etapas alterada',
    title: 'Fator de segurança removido',
    introduction: 'Um fator de segurança foi removido da sua conta.',
  },
};

function invalidInput(code = 'invalid_payload'): never {
  throw new AuthEmailInputError(code);
}

function requireValue(value: string | undefined): string {
  if (!value) invalidInput();
  return value;
}

function validateBrandName(brandName: string): void {
  if (
    brandName.length < 1 ||
    brandName.length > 80 ||
    CONTROL_CHARACTER.test(brandName) ||
    BRAND_DELIMITER.test(brandName)
  ) {
    invalidInput('invalid_brand');
  }
}

function validateRedirect(payload: AuthEmailHookPayload, config: AuthEmailRuntimeConfig): void {
  const redirectTo = payload.email_data.redirect_to;
  if (redirectTo && !isAllowedAuthRedirect(redirectTo, config.allowedRedirectPrefixes)) {
    invalidInput('invalid_redirect');
  }
}

function subject(brandName: string, suffix: string): string {
  return `${brandName}: ${suffix}`;
}

function actionUrl(
  payload: AuthEmailHookPayload,
  config: AuthEmailRuntimeConfig,
  tokenHash: string
): string {
  return buildAuthVerificationUrl({
    supabaseUrl: config.supabaseUrl,
    tokenHash,
    actionType: payload.email_data.email_action_type,
    redirectTo: requireValue(payload.email_data.redirect_to),
    allowedRedirectPrefixes: config.allowedRedirectPrefixes,
  });
}

function plan(
  payload: AuthEmailHookPayload,
  config: AuthEmailRuntimeConfig,
  input: Omit<AuthEmailMessagePlan, 'actionType' | 'subject' | 'preview'> & { subjectSuffix: string }
): AuthEmailMessagePlan {
  const { subjectSuffix, ...message } = input;
  const title = message.title;
  return {
    ...message,
    actionType: payload.email_data.email_action_type,
    subject: subject(config.brandName, subjectSuffix),
    preview: title,
  };
}

export function buildAuthVerificationUrl(input: {
  supabaseUrl: string;
  tokenHash: string;
  actionType: AuthEmailActionType;
  redirectTo: string;
  allowedRedirectPrefixes: string[];
}): string {
  if (!input.tokenHash || !input.redirectTo || !isAllowedAuthRedirect(input.redirectTo, input.allowedRedirectPrefixes)) {
    invalidInput('invalid_redirect');
  }
  let origin: URL;
  try {
    origin = new URL(input.supabaseUrl);
  } catch {
    invalidInput('invalid_supabase_url');
  }
  if (
    origin.username || origin.password || origin.pathname !== '/' ||
    origin.search || origin.hash || !origin.hostname
  ) {
    invalidInput('invalid_supabase_url');
  }
  const parameters = new URLSearchParams({
    token_hash: input.tokenHash,
    type: input.actionType,
    redirect_to: input.redirectTo,
  });
  return `${origin.origin}/auth/v1/verify?${parameters.toString()}`;
}

function planEmailChange(
  payload: AuthEmailHookPayload,
  config: AuthEmailRuntimeConfig
): AuthEmailMessagePlan[] {
  const { user, email_data: emailData } = payload;
  const subjectSuffix = 'confirme a alteração de e-mail';
  const actionLabel = 'Confirmar alteração';
  const newEmail = requireValue(user.new_email);

  if (emailData.token_hash_new) {
    const currentToken = requireValue(emailData.token);
    const currentTokenHash = requireValue(emailData.token_hash_new);
    const newToken = requireValue(emailData.token_new);
    const newTokenHash = requireValue(emailData.token_hash);
    return [
      plan(payload, config, {
        subjectSuffix,
        recipientRole: 'current_email',
        to: requireValue(user.email),
        title: 'Confirme a alteração no e-mail atual',
        introduction: 'Use o código ou o link abaixo para confirmar a alteração do seu e-mail atual.',
        safetyNotice: ACTION_SAFETY_NOTICE,
        token: currentToken,
        tokenHash: currentTokenHash,
        actionUrl: actionUrl(payload, config, currentTokenHash),
        actionLabel,
      }),
      plan(payload, config, {
        subjectSuffix,
        recipientRole: 'new_email',
        to: newEmail,
        title: 'Confirme a alteração no novo e-mail',
        introduction: 'Use o código ou o link abaixo para confirmar a alteração para este novo e-mail.',
        safetyNotice: ACTION_SAFETY_NOTICE,
        token: newToken,
        tokenHash: newTokenHash,
        actionUrl: actionUrl(payload, config, newTokenHash),
        actionLabel,
      }),
    ];
  }

  const token = requireValue(emailData.token_new || emailData.token);
  const tokenHash = requireValue(emailData.token_hash);
  return [plan(payload, config, {
    subjectSuffix,
    recipientRole: 'new_email',
    to: newEmail,
    title: 'Confirme a alteração de e-mail',
    introduction: 'Use o código ou o link abaixo para confirmar a alteração do seu e-mail.',
    safetyNotice: ACTION_SAFETY_NOTICE,
    token,
    tokenHash,
    actionUrl: actionUrl(payload, config, tokenHash),
    actionLabel,
  })];
}

export function planAuthEmail(
  payload: AuthEmailHookPayload,
  config: AuthEmailRuntimeConfig
): AuthEmailMessagePlan[] {
  validateBrandName(config.brandName);
  validateRedirect(payload, config);
  const actionType = payload.email_data.email_action_type;

  if (actionType === 'email_change') return planEmailChange(payload, config);

  if (actionType === 'identity_unlinked_notification') {
    // O hook não expõe o destinatário capturado antes do unlink; user.email pode já ser outro endereço.
    invalidInput('unsupported_action');
  }

  if (actionType === 'email_changed_notification') {
    const copy = NOTIFICATION_COPY[actionType];
    return [plan(payload, config, {
      subjectSuffix: copy.subjectSuffix,
      recipientRole: 'primary',
      to: requireValue(payload.email_data.old_email),
      title: copy.title,
      introduction: copy.introduction,
      safetyNotice: SECURITY_SAFETY_NOTICE,
    })];
  }

  if (actionType in NOTIFICATION_COPY) {
    const copy = NOTIFICATION_COPY[actionType as keyof typeof NOTIFICATION_COPY];
    return [plan(payload, config, {
      subjectSuffix: copy.subjectSuffix,
      recipientRole: 'primary',
      to: requireValue(payload.user.email),
      title: copy.title,
      introduction: copy.introduction,
      safetyNotice: SECURITY_SAFETY_NOTICE,
    })];
  }

  const copy = ACTION_COPY[actionType as keyof typeof ACTION_COPY];
  const token = copy.includesToken ? requireValue(payload.email_data.token) : undefined;
  const tokenHash = copy.includesLink ? requireValue(payload.email_data.token_hash) : undefined;
  return [plan(payload, config, {
    subjectSuffix: copy.subjectSuffix,
    recipientRole: 'primary',
    to: requireValue(payload.user.email),
    title: copy.title,
    introduction: copy.introduction,
    safetyNotice: ACTION_SAFETY_NOTICE,
    ...(token === undefined ? {} : { token }),
    ...(tokenHash === undefined ? {} : { tokenHash }),
    ...(copy.includesLink ? {
      actionUrl: actionUrl(payload, config, tokenHash!),
      actionLabel: copy.actionLabel!,
    } : {}),
  })];
}
