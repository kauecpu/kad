import {
  AUTH_EMAIL_ACTION_TYPES,
  type AuthEmailActionType,
} from './auth-email-contract.ts';
import type { AuthEmailRecipientRole } from './auth-email-plan.ts';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
export const DEFAULT_RESEND_TIMEOUT_MS = 1_250;
const BODY_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const RESPONSE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const PROVIDER_CODE_PATTERN = /^[a-z0-9_-]{1,80}$/;
const MAX_IDEMPOTENCY_KEY_LENGTH = 256;

export type OutboundAuthEmail = {
  actionType: AuthEmailActionType;
  recipientRole: AuthEmailRecipientRole;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailTransport = {
  send(message: OutboundAuthEmail, idempotencyKey: string): Promise<{ id: string }>;
};

export class ResendTransportError extends Error {
  readonly kind: 'transient' | 'permanent';
  readonly status?: number;
  readonly providerCode?: string;

  constructor(
    kind: 'transient' | 'permanent',
    status?: number,
    providerCode?: string
  ) {
    super('resend_transport_failed');
    this.name = 'ResendTransportError';
    this.kind = kind;
    this.status = status;
    this.providerCode = providerCode;
  }
}

export async function authEmailBodyDigest(rawBody: string): Promise<string> {
  const bytes = new TextEncoder().encode(rawBody);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function authEmailIdempotencyKey(input: {
  bodyDigest: string;
  actionType: AuthEmailActionType;
  recipientRole: AuthEmailRecipientRole;
}): string {
  if (!BODY_DIGEST_PATTERN.test(input.bodyDigest)) {
    throw new Error('invalid_idempotency_key');
  }
  const key = `auth/${input.actionType}/${input.recipientRole}/${input.bodyDigest}`;
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new Error('invalid_idempotency_key');
  }
  return key;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

async function responseJson(response: Response): Promise<unknown> {
  let rawBody: string;
  try {
    rawBody = await response.text();
  } catch {
    throw new ResendTransportError('transient', response.status);
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return undefined;
  }
}

function responseId(value: unknown): string | undefined {
  if (!isPlainObject(value) || typeof value.id !== 'string' || !RESPONSE_ID_PATTERN.test(value.id)) {
    return undefined;
  }
  return value.id;
}

function providerCode(value: unknown): string | undefined {
  if (!isPlainObject(value) || typeof value.name !== 'string' || !PROVIDER_CODE_PATTERN.test(value.name)) {
    return undefined;
  }
  return value.name;
}

function errorKind(status: number, code: string | undefined): 'transient' | 'permanent' {
  if (status === 409) {
    return code === 'concurrent_idempotent_requests' ? 'transient' : 'permanent';
  }
  if (status === 429) {
    return code === 'rate_limit_exceeded' ? 'transient' : 'permanent';
  }
  if (status >= 500 && status <= 599) return 'transient';
  return 'permanent';
}

function validateIdempotencyKey(
  key: string,
  message: Pick<OutboundAuthEmail, 'actionType' | 'recipientRole'>
): void {
  const parts = key.split('/');
  const [, actionType, recipientRole, bodyDigest] = parts;
  if (
    key.length === 0 ||
    key.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    parts.length !== 4 ||
    parts[0] !== 'auth' ||
    !AUTH_EMAIL_ACTION_TYPES.includes(actionType as AuthEmailActionType) ||
    actionType !== message.actionType ||
    recipientRole !== message.recipientRole ||
    !BODY_DIGEST_PATTERN.test(bodyDigest)
  ) {
    throw new ResendTransportError('permanent');
  }
}

export function createResendEmailTransport(options: {
  apiKey: string;
  from: string;
  replyTo?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): EmailTransport {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_RESEND_TIMEOUT_MS;

  return {
    async send(message, idempotencyKey) {
      validateIdempotencyKey(idempotencyKey, message);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(RESEND_EMAILS_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'auth-email-hook/1.0',
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({
              from: options.from,
              to: [message.to],
              subject: message.subject,
              html: message.html,
              text: message.text,
              ...(options.replyTo === undefined ? {} : { reply_to: options.replyTo }),
              tags: [
                { name: 'auth_event', value: message.actionType },
                { name: 'recipient_role', value: message.recipientRole },
              ],
            }),
            signal: controller.signal,
          });
        } catch {
          throw new ResendTransportError('transient');
        }

        const body = await responseJson(response);
        if (response.ok) {
          const id = responseId(body);
          if (id === undefined) throw new ResendTransportError('permanent', response.status);
          return { id };
        }

        const code = providerCode(body);
        throw new ResendTransportError(errorKind(response.status, code), response.status, code);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
