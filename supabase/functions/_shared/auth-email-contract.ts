export const AUTH_EMAIL_ACTION_TYPES = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
  'reauthentication',
  'password_changed_notification',
  'email_changed_notification',
  'phone_changed_notification',
  'identity_linked_notification',
  'identity_unlinked_notification',
  'mfa_factor_enrolled_notification',
  'mfa_factor_unenrolled_notification',
] as const;

export type AuthEmailActionType = typeof AUTH_EMAIL_ACTION_TYPES[number];

export type AuthEmailHookPayload = {
  user: { id: string; email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AuthEmailActionType;
    site_url: string;
    token_new: string;
    token_hash_new: string;
    old_email?: string;
    old_phone?: string;
    provider?: string;
    factor_type?: string;
  };
};

export class AuthEmailInputError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'AuthEmailInputError';
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new AuthEmailInputError('invalid_payload');
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value);
}

function email(value: unknown): string {
  if (typeof value !== 'string') throw new AuthEmailInputError('invalid_email');
  if (CONTROL_CHARACTER.test(value)) throw new AuthEmailInputError('invalid_email');
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 254 ||
    trimmed.split('@').length !== 2
  ) {
    throw new AuthEmailInputError('invalid_email');
  }
  return trimmed;
}

function optionalEmail(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === '') return '';
  return email(value);
}

export function parseAuthEmailHookPayload(value: unknown): AuthEmailHookPayload {
  if (!isPlainObject(value) || !isPlainObject(value.user) || !isPlainObject(value.email_data)) {
    throw new AuthEmailInputError('invalid_payload');
  }
  const user = value.user;
  const emailData = value.email_data;
  const id = requiredString(user.id);
  if (id.length > 64 || !UUID_PATTERN.test(id)) {
    throw new AuthEmailInputError('invalid_payload');
  }
  const action = requiredString(emailData.email_action_type);
  if (!AUTH_EMAIL_ACTION_TYPES.includes(action as AuthEmailActionType)) {
    throw new AuthEmailInputError('unsupported_action');
  }

  return {
    user: {
      id,
      email: email(user.email),
      ...(user.new_email === undefined ? {} : { new_email: email(user.new_email) }),
    },
    email_data: {
      token: requiredString(emailData.token),
      token_hash: requiredString(emailData.token_hash),
      redirect_to: requiredString(emailData.redirect_to),
      email_action_type: action as AuthEmailActionType,
      site_url: requiredString(emailData.site_url),
      token_new: requiredString(emailData.token_new),
      token_hash_new: requiredString(emailData.token_hash_new),
      ...(emailData.old_email === undefined ? {} : { old_email: optionalEmail(emailData.old_email) }),
      ...(emailData.old_phone === undefined ? {} : { old_phone: optionalString(emailData.old_phone) }),
      ...(emailData.provider === undefined ? {} : { provider: optionalString(emailData.provider) }),
      ...(emailData.factor_type === undefined ? {} : { factor_type: optionalString(emailData.factor_type) }),
    },
  };
}
