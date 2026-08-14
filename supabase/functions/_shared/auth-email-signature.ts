import { Webhook, WebhookVerificationError } from 'standardwebhooks';

export class AuthEmailSignatureError extends Error {
  constructor() {
    super('invalid_signature');
    this.name = 'AuthEmailSignatureError';
  }
}

export function verifyAuthEmailHook(
  rawBody: string,
  headers: Record<string, string>,
  secret: string
): unknown {
  const normalizedSecret = secret.startsWith('v1,') ? secret.slice(3) : secret;
  const webhook = new Webhook(normalizedSecret);
  try {
    return webhook.verify(rawBody, headers);
  } catch (error) {
    if (error instanceof WebhookVerificationError) throw new AuthEmailSignatureError();
    if (error instanceof SyntaxError) throw error;
    throw new AuthEmailSignatureError();
  }
}
