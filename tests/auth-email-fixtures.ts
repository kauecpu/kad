import { Buffer } from 'node:buffer';
import { Webhook } from 'standardwebhooks';

import type { AuthEmailHookPayload } from '../supabase/functions/_shared/auth-email-contract.ts';
import type { AuthEmailRuntimeConfig } from '../supabase/functions/_shared/auth-email-config.ts';

export const TEST_WEBHOOK_ID = 'msg_auth_001';
export const TEST_HOOK_SECRET =
  `whsec_${Buffer.from('segredo-de-teste-com-32-bytes!!').toString('base64')}`;

export const TEST_AUTH_EMAIL_CONFIG: AuthEmailRuntimeConfig = {
  resendApiKey: 're_test_key',
  hookSecret: TEST_HOOK_SECRET,
  brandName: 'Marca de Teste',
  fromAddress: 'conta@email.exemplo.com',
  replyTo: 'suporte@exemplo.com',
  allowedRedirectPrefixes: ['kad://', 'https://app.exemplo.com/auth/'],
  supabaseUrl: 'https://projeto.supabase.co',
};

type PayloadOverrides = {
  user?: Partial<AuthEmailHookPayload['user']>;
  email_data?: Partial<AuthEmailHookPayload['email_data']>;
};

export function authEmailPayload(
  actionType: AuthEmailHookPayload['email_data']['email_action_type'] = 'signup',
  overrides: PayloadOverrides = {}
): AuthEmailHookPayload {
  return {
    user: {
      id: '8484b834-f29e-4af2-bf42-80644d154f76',
      email: 'pessoa@exemplo.com',
      new_email: 'novo@exemplo.com',
      ...overrides.user,
    },
    email_data: {
      token: '305805',
      token_hash: 'hash-do-endereco-novo',
      redirect_to: 'kad://auth/login',
      email_action_type: actionType,
      site_url: 'https://projeto.supabase.co',
      token_new: '905409',
      token_hash_new: 'hash-do-endereco-atual',
      old_email: '',
      old_phone: '',
      provider: '',
      factor_type: '',
      ...overrides.email_data,
    },
  };
}

export function signedAuthEmailRequest(
  payloadOrRawBody: unknown | string,
  options: { webhookId?: string; timestamp?: Date; secret?: string } = {}
): Request {
  const rawBody = typeof payloadOrRawBody === 'string'
    ? payloadOrRawBody
    : JSON.stringify(payloadOrRawBody);
  const webhookId = options.webhookId ?? TEST_WEBHOOK_ID;
  const timestamp = options.timestamp ?? new Date();
  const secret = options.secret ?? TEST_HOOK_SECRET;
  const webhook = new Webhook(secret);
  return new Request('http://localhost/functions/v1/send-auth-email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': webhookId,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': webhook.sign(webhookId, timestamp, rawBody),
    },
    body: rawBody,
  });
}
