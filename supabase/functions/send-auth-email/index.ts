import { formatResendFrom, loadAuthEmailConfig } from '../_shared/auth-email-config.ts';
import { createAuthEmailHandler } from '../_shared/auth-email-handler.ts';
import { verifyAuthEmailHook } from '../_shared/auth-email-signature.ts';
import { createResendEmailTransport } from '../_shared/resend-email.ts';

const readEnv = (name: string) => Deno.env.get(name);

const handler = createAuthEmailHandler({
  loadConfig: () => loadAuthEmailConfig(readEnv),
  verifyHook: verifyAuthEmailHook,
  createTransport: (config) => createResendEmailTransport({
    apiKey: config.resendApiKey,
    from: formatResendFrom(config.brandName, config.fromAddress),
    replyTo: config.replyTo,
  }),
  logger: (entry) => console.log(JSON.stringify(entry)),
});

Deno.serve(handler);
