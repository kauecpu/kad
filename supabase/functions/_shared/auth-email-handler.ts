import {
  AuthEmailInputError,
  type AuthEmailActionType,
  parseAuthEmailHookPayload,
} from './auth-email-contract.ts';
import {
  AuthEmailConfigurationError,
  type AuthEmailRuntimeConfig,
} from './auth-email-config.ts';
import { planAuthEmail } from './auth-email-plan.ts';
import {
  AuthEmailSignatureError,
  verifyAuthEmailHook,
} from './auth-email-signature.ts';
import { authEmailIdempotencyKey, type EmailTransport, type OutboundAuthEmail, ResendTransportError } from './resend-email.ts';
import { renderAuthEmail } from './auth-email-template.ts';

const BODY_LIMIT_BYTES = 65_536;
const WEBHOOK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const RESEND_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CONFIG_NAME_ALLOWLIST = new Set([
  'RESEND_API_KEY',
  'SEND_EMAIL_HOOK_SECRET',
  'EMAIL_BRAND_NAME',
  'EMAIL_FROM_ADDRESS',
  'EMAIL_REPLY_TO',
  'EMAIL_ALLOWED_REDIRECT_PREFIXES',
  'SUPABASE_URL',
]);

export type AuthEmailLogEntry = {
  event: 'auth_email_succeeded' | 'auth_email_failed';
  webhookId?: string;
  actionType?: AuthEmailActionType;
  messageCount?: number;
  acceptedEmailIds?: string[];
  errorCode?: string;
  invalidConfigNames?: string[];
  providerStatus?: number;
  durationMs: number;
};

export type AuthEmailHandlerDependencies = {
  loadConfig: () => AuthEmailRuntimeConfig;
  verifyHook: typeof verifyAuthEmailHook;
  createTransport: (config: AuthEmailRuntimeConfig) => EmailTransport;
  logger: (entry: AuthEmailLogEntry) => void;
  now?: () => number;
};

class BodyReadError extends Error {
  readonly code: 'payload_too_large' | 'invalid_payload';

  constructor(code: 'payload_too_large' | 'invalid_payload') {
    super(code);
    this.name = 'BodyReadError';
    this.code = code;
  }
}

function errorResponse(status: number, error: string, headers?: HeadersInit): Response {
  return Response.json({ error }, { status, headers });
}

function lowercaseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, name) => { result[name.toLowerCase()] = value; });
  return result;
}

function allowedConfigNames(names: string[]): string[] {
  return names.filter((name) => CONFIG_NAME_ALLOWLIST.has(name));
}

function safeProviderStatus(status: number | undefined): number | undefined {
  return Number.isInteger(status) && status! >= 100 && status! <= 599 ? status : undefined;
}

async function readBodyWithLimit(request: Request, limit: number): Promise<string> {
  const contentLength = request.headers.get('content-length');
  const declaredLength = contentLength === null ? undefined : Number(contentLength);
  if (Number.isInteger(declaredLength) && declaredLength! > limit) {
    throw new BodyReadError('payload_too_large');
  }
  if (request.body === null) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BodyReadError('payload_too_large');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof BodyReadError) throw error;
    throw new BodyReadError('invalid_payload');
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new BodyReadError('invalid_payload');
  }
}

function outboundMessage(
  plan: ReturnType<typeof planAuthEmail>[number],
  brandName: string
): OutboundAuthEmail {
  const rendered = renderAuthEmail(plan, brandName);
  return {
    actionType: plan.actionType,
    recipientRole: plan.recipientRole,
    to: plan.to,
    subject: plan.subject,
    html: rendered.html,
    text: rendered.text,
  };
}

export function createAuthEmailHandler(
  dependencies: AuthEmailHandlerDependencies
): (request: Request) => Promise<Response> {
  const now = dependencies.now ?? Date.now;

  return async (request) => {
    const startedAt = now();
    let webhookId: string | undefined;
    let actionType: AuthEmailActionType | undefined;
    const acceptedEmailIds: string[] = [];

    const durationMs = () => Math.max(0, now() - startedAt);
    const logFailure = (input: {
      errorCode: string;
      invalidConfigNames?: string[];
      providerStatus?: number;
    }) => {
      const entry: AuthEmailLogEntry = {
        event: 'auth_email_failed',
        ...(webhookId === undefined ? {} : { webhookId }),
        ...(actionType === undefined ? {} : { actionType }),
        ...(acceptedEmailIds.length === 0 ? {} : { acceptedEmailIds: [...acceptedEmailIds] }),
        errorCode: input.errorCode,
        ...(input.invalidConfigNames === undefined ? {} : { invalidConfigNames: input.invalidConfigNames }),
        ...(input.providerStatus === undefined ? {} : { providerStatus: input.providerStatus }),
        durationMs: durationMs(),
      };
      dependencies.logger(entry);
    };
    const fail = (status: number, errorCode: string, options: {
      invalidConfigNames?: string[];
      providerStatus?: number;
      headers?: HeadersInit;
    } = {}) => {
      logFailure(options.invalidConfigNames === undefined && options.providerStatus === undefined
        ? { errorCode }
        : {
          errorCode,
          ...(options.invalidConfigNames === undefined ? {} : { invalidConfigNames: options.invalidConfigNames }),
          ...(options.providerStatus === undefined ? {} : { providerStatus: options.providerStatus }),
        });
      return errorResponse(status, errorCode, options.headers);
    };

    if (request.method !== 'POST') {
      return fail(405, 'method_not_allowed', { headers: { Allow: 'POST' } });
    }

    let rawBody: string;
    try {
      rawBody = await readBodyWithLimit(request, BODY_LIMIT_BYTES);
    } catch (error) {
      if (error instanceof BodyReadError) {
        return fail(error.code === 'payload_too_large' ? 413 : 422, error.code);
      }
      return fail(500, 'internal_error');
    }

    let config: AuthEmailRuntimeConfig;
    try {
      config = dependencies.loadConfig();
    } catch (error) {
      if (error instanceof AuthEmailConfigurationError) {
        return fail(500, 'configuration_error', {
          invalidConfigNames: allowedConfigNames(error.missingOrInvalidNames),
        });
      }
      return fail(500, 'internal_error');
    }

    const headers = lowercaseHeaders(request.headers);
    let verified: unknown;
    try {
      verified = dependencies.verifyHook(rawBody, headers, config.hookSecret);
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof AuthEmailInputError) {
        return fail(422, 'invalid_payload');
      }
      if (error instanceof AuthEmailSignatureError) return fail(401, 'invalid_signature');
      return fail(500, 'internal_error');
    }

    let payload;
    try {
      payload = parseAuthEmailHookPayload(verified);
      actionType = payload.email_data.email_action_type;
      const candidateWebhookId = headers['webhook-id'];
      if (candidateWebhookId === undefined || !WEBHOOK_ID_PATTERN.test(candidateWebhookId)) {
        return fail(422, 'invalid_payload');
      }
      webhookId = candidateWebhookId;
    } catch (error) {
      if (error instanceof AuthEmailInputError) return fail(422, error.code);
      return fail(500, 'internal_error');
    }

    let messages: OutboundAuthEmail[];
    try {
      messages = planAuthEmail(payload, config).map((plan) => outboundMessage(plan, config.brandName));
    } catch (error) {
      if (error instanceof AuthEmailInputError) return fail(422, error.code);
      return fail(500, 'internal_error');
    }

    let transport: EmailTransport;
    try {
      transport = dependencies.createTransport(config);
      for (const message of messages) {
        const result = await transport.send(message, authEmailIdempotencyKey({
          webhookId,
          actionType: message.actionType,
          recipientRole: message.recipientRole,
        }));
        if (!RESEND_ID_PATTERN.test(result.id)) return fail(500, 'internal_error');
        acceptedEmailIds.push(result.id);
      }
    } catch (error) {
      if (error instanceof ResendTransportError) {
        const retryablePartialAcceptance = acceptedEmailIds.length > 0;
        return fail(
          retryablePartialAcceptance || error.kind === 'transient' ? 503 : 502,
          retryablePartialAcceptance || error.kind === 'transient'
            ? 'provider_transient_error'
            : 'provider_permanent_error',
          { providerStatus: safeProviderStatus(error.status) }
        );
      }
      return fail(500, 'internal_error');
    }

    dependencies.logger({
      event: 'auth_email_succeeded',
      webhookId,
      actionType,
      messageCount: messages.length,
      acceptedEmailIds: [...acceptedEmailIds],
      durationMs: durationMs(),
    });
    return Response.json({});
  };
}
