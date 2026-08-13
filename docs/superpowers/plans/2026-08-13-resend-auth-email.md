# Resend Auth Email Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar uma Edge Function testável e segura que receba o Send Email Hook do Supabase Auth e envie todos os e-mails de autenticação pela API do Resend, sem ativar ou alterar serviços remotos.

**Architecture:** O Supabase Auth chama `send-auth-email` por HTTPS e assina o corpo com Standard Webhooks. Módulos TypeScript puros validam configuração e payload, planejam uma ou duas mensagens, renderizam HTML/texto e chamam `POST https://api.resend.com/emails`; o `index.ts` conecta esses módulos ao ambiente Deno. O aplicativo Expo e seus fluxos atuais de autenticação não mudam.

**Tech Stack:** Expo SDK 54 existente, Supabase Auth Send Email Hook, Supabase Edge Functions/Deno 2.9.5, TypeScript, Standard Webhooks 1.0.0, Resend Email API HTTPS, Node Test Runner.

## Global Constraints

- Trabalhar somente na worktree `C:\Users\unluc\kad\.worktrees\resend-auth-email`, branch `codex/integrate-resend-auth-email`, baseada em `origin/main` no commit `1c4e2a6`.
- Não incorporar os commits nem o arquivo não rastreado da atividade de pagamentos na pasta principal.
- Não alterar `app/`, `providers/`, pagamentos, `admin/`, collector, CI, infraestrutura remota ou banco de dados.
- Usar a API HTTPS do Resend. Não configurar SMTP.
- Manter `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, marca, remetente e reply-to fora do bundle Expo e fora do Git.
- Não implantar a função, criar secrets, habilitar o Send Email Hook ou enviar e-mail real nesta entrega.
- Não registrar e-mail, OTP, token, hash, URL de ação, corpo da mensagem ou segredo.
- Manter o esquema `kad://` e o fluxo PKCE atual.
- Cobrir `signup`, `email`, `recovery`, `magiclink`, `invite`, `reauthentication`, `email_change` e as sete notificações de segurança publicadas pelo Supabase Auth.
- Rejeitar tipos de evento desconhecidos e redirects fora da allowlist.
- Usar HTML responsivo sem imagem externa, pixel de abertura ou rastreamento de clique, com alternativa em texto puro.
- Fixar `standardwebhooks` em `1.0.0`; usar a API Resend via `fetch`, sem adicionar o SDK Resend ao aplicativo.
- Executar `npm.cmd run check` e o typecheck Deno antes de concluir.
- Fazer revisão de segurança do diff, commit, push e abrir Pull Request para `main`; não fazer merge.

## Baseline verificado

- `npm.cmd ci` concluiu na worktree.
- `npm.cmd run check` passou com 79 testes, typecheck e lint.
- A documentação consultada foi a versão exata do Expo SDK 54 e as páginas atuais do Supabase Send Email Hook e Resend.

## Estrutura de arquivos

### Novos arquivos

- `supabase/functions/_shared/auth-email-contract.ts`: tipos e validação estrutural do payload assinado.
- `supabase/functions/_shared/auth-email-config.ts`: leitura e validação das variáveis server-side e redirects.
- `supabase/functions/_shared/auth-email-signature.ts`: adaptador de `standardwebhooks` e normalização do segredo do hook.
- `supabase/functions/_shared/auth-email-plan.ts`: matriz de eventos, destinatários, links e modelos de conteúdo.
- `supabase/functions/_shared/auth-email-template.ts`: renderer HTML/texto e escape de conteúdo.
- `supabase/functions/_shared/resend-email.ts`: transporte HTTP, idempotência e classificação de falhas.
- `supabase/functions/_shared/auth-email-handler.ts`: limite do corpo, orquestração HTTP, respostas e logs.
- `supabase/functions/send-auth-email/index.ts`: composição Deno sem lógica de negócio.
- `supabase/functions/send-auth-email/deno.json`: import Deno fixado de Standard Webhooks.
- `tests/auth-email-fixtures.ts`: payload, configuração e requisições assinadas compartilhadas pelos testes.
- `tests/auth-email-contract.test.ts`: configuração, contrato, assinatura e redirects.
- `tests/auth-email-plan.test.ts`: matriz de eventos, mudança de e-mail, links e templates.
- `tests/resend-email.test.ts`: contrato da API, headers, idempotência e erros.
- `tests/auth-email-handler.test.ts`: integração local do handler com dependências falsas.
- `docs/EMAILS.md`: configuração, ativação futura, verificação e rollback.

### Arquivos modificados

- `package.json`: `standardwebhooks@1.0.0` como devDependency para os testes Node.
- `package-lock.json`: lockfile atualizado pelo npm.
- `supabase/config.toml`: `verify_jwt = false` somente para `send-auth-email`, além do webhook existente.
- `README.md`: link curto para `docs/EMAILS.md`.

---

### Task 0: Preflight de autorização, branch e escopo

**Files:**

- Review only: `AGENTS.md`, Git metadata and this approved plan.
- Modify: none.

**Authorization:** The project owner explicitly requested the Resend integration, authorized security-sensitive care and approved every design section before requesting this plan. That authorization covers the scoped `supabase/functions/` and `supabase/config.toml` changes listed here; it does not cover remote deployment or unrelated Supabase resources.

- [ ] **Step 1: Confirmar árvore limpa e branch correta**

Run before any package or source mutation:

```powershell
git status --short --branch
git branch --show-current
```

Expected: clean worktree on `codex/integrate-resend-auth-email`. The design and this plan must already be tracked. If any unexpected or payment-related path appears, stop and preserve it; do not stage, move or delete it.

- [ ] **Step 2: Atualizar a referência de `main` e validar a base**

Run:

```powershell
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
```

Expected: both commands exit 0. If the ancestry check exits 1, rebase this clean feature branch with `git rebase origin/main`, resolve only conflicts in the approved email design/plan, then repeat both preflight steps. Never use or modify the primary payment checkout.

- [ ] **Step 3: Ler as referências obrigatórias antes da primeira edição**

Open and read these exact/current primary references before writing implementation code:

- Expo SDK 54: `https://docs.expo.dev/versions/v54.0.0/`
- Supabase Send Email Hook: `https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook`
- Supabase Auth Hooks changelog: `https://supabase.com/changelog?query=auth+hooks`
- Resend Email API: `https://resend.com/docs/api-reference/emails/send-email`
- Resend errors: `https://resend.com/docs/api-reference/errors`
- Standard Webhooks verification spec: `https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md`

Record materially changed contracts in the implementation notes before proceeding. Do not substitute an unversioned Expo page for the required SDK 54 documentation.

---

### Task 1: Contrato, configuração e assinatura do hook

**Files:**

- Create: `supabase/functions/_shared/auth-email-contract.ts`
- Create: `supabase/functions/_shared/auth-email-config.ts`
- Create: `supabase/functions/_shared/auth-email-signature.ts`
- Create: `tests/auth-email-fixtures.ts`
- Create: `tests/auth-email-contract.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Produces: `AuthEmailActionType`, `AuthEmailHookPayload`, `parseAuthEmailHookPayload(value)`.
- Produces: `AuthEmailRuntimeConfig`, `loadAuthEmailConfig(readEnv)`, `isAllowedAuthRedirect(value, prefixes)`, `formatResendFrom(brandName, address)`.
- Produces: `verifyAuthEmailHook(rawBody, headers, secret)`.
- Consumes later: Tasks 2 and 4 import these exact names.

- [ ] **Step 1: Instalar a única dependência de teste com versão exata**

Run:

```powershell
npm.cmd install --save-dev --save-exact standardwebhooks@1.0.0
```

Expected: `package.json` contains `"standardwebhooks": "1.0.0"`; `package-lock.json` records the resolved package and integrity hash.

- [ ] **Step 2: Criar fixtures compartilhadas e escrever os testes falhos do contrato**

Create `tests/auth-email-fixtures.ts` so later test files do not invent incompatible payloads or signatures:

```ts
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
```

Tests for expired signatures must pass an explicit timestamp older than five minutes; ordinary signed requests use the current time.

Create `tests/auth-email-contract.test.ts` with the shared valid fixture and these assertions:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { Webhook } from 'standardwebhooks';

import {
  AUTH_EMAIL_ACTION_TYPES,
  parseAuthEmailHookPayload,
} from '../supabase/functions/_shared/auth-email-contract.ts';
import {
  formatResendFrom,
  isAllowedAuthRedirect,
  loadAuthEmailConfig,
} from '../supabase/functions/_shared/auth-email-config.ts';
import { verifyAuthEmailHook } from '../supabase/functions/_shared/auth-email-signature.ts';

const validPayload = {
  user: {
    id: '8484b834-f29e-4af2-bf42-80644d154f76',
    email: 'pessoa@exemplo.com',
    new_email: 'novo@exemplo.com',
  },
  email_data: {
    token: '305805',
    token_hash: '7d5b7b1964cf5d388340a7f04f1db',
    redirect_to: 'kad://auth/login',
    email_action_type: 'signup',
    site_url: 'https://projeto.supabase.co',
    token_new: '',
    token_hash_new: '',
    old_email: '',
    old_phone: '',
    provider: '',
    factor_type: '',
  },
};

test('aceita todos os tipos publicados pelo Supabase Auth', () => {
  assert.deepEqual(AUTH_EMAIL_ACTION_TYPES, [
    'signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email',
    'reauthentication', 'password_changed_notification',
    'email_changed_notification', 'phone_changed_notification',
    'identity_linked_notification', 'identity_unlinked_notification',
    'mfa_factor_enrolled_notification', 'mfa_factor_unenrolled_notification',
  ]);
});

test('recusa evento desconhecido e campos com quebra de cabeçalho', () => {
  assert.throws(() => parseAuthEmailHookPayload({
    ...validPayload,
    email_data: { ...validPayload.email_data, email_action_type: 'future_event' },
  }), /unsupported_action/);
  assert.throws(() => parseAuthEmailHookPayload({
    ...validPayload,
    user: { ...validPayload.user, email: 'pessoa@exemplo.com\r\nBcc: atacante@exemplo.com' },
  }), /invalid_email/);
});

test('carrega somente configuração server-side válida', () => {
  const encodedHookFixture = Buffer.from('fixture-publica-com-32-bytes!!!').toString('base64');
  const values: Record<string, string> = {
    RESEND_API_KEY: 're_test_key',
    SEND_EMAIL_HOOK_SECRET: `v1,whsec_${encodedHookFixture}`,
    EMAIL_BRAND_NAME: 'Marca de Teste',
    EMAIL_FROM_ADDRESS: 'conta@email.exemplo.com',
    EMAIL_REPLY_TO: 'suporte@exemplo.com',
    EMAIL_ALLOWED_REDIRECT_PREFIXES: 'kad://,https://app.exemplo.com/auth/',
    SUPABASE_URL: 'https://projeto.supabase.co',
  };
  const config = loadAuthEmailConfig((name) => values[name]);
  assert.equal(config.brandName, 'Marca de Teste');
  assert.equal(config.allowedRedirectPrefixes.length, 2);
  assert.equal(
    formatResendFrom(config.brandName, config.fromAddress),
    'Marca de Teste <conta@email.exemplo.com>'
  );
  assert.equal(Object.hasOwn(config, 'EXPO_PUBLIC_RESEND_API_KEY'), false);
});

test('compara origem e limite de caminho sem aceitar domínio parecido', () => {
  const allowed = ['kad://', 'https://app.exemplo.com/auth/'];
  assert.equal(isAllowedAuthRedirect('kad://auth/nova-senha', allowed), true);
  assert.equal(isAllowedAuthRedirect('https://app.exemplo.com/auth/login', allowed), true);
  assert.equal(isAllowedAuthRedirect('https://app.exemplo.com.evil/auth/login', allowed), false);
  assert.equal(isAllowedAuthRedirect('javascript:alert(1)', allowed), false);
});

test('valida assinatura, timestamp e corpo bruto', () => {
  const secret = `whsec_${Buffer.from('segredo-de-teste-com-32-bytes!!').toString('base64')}`;
  const rawBody = JSON.stringify(validPayload);
  const webhook = new Webhook(secret);
  const timestamp = new Date();
  const headers = {
    'webhook-id': 'msg_auth_001',
    'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
    'webhook-signature': webhook.sign('msg_auth_001', timestamp, rawBody),
  };
  assert.deepEqual(verifyAuthEmailHook(rawBody, headers, `v1,${secret}`), validPayload);
  assert.throws(
    () => verifyAuthEmailHook(`${rawBody} `, headers, `v1,${secret}`),
    /invalid_signature/
  );
});
```

Add focused cases for missing env names, invalid `SUPABASE_URL`, HTTP non-local Supabase URL, invalid from/reply-to, empty prefix list, missing webhook headers, invalid signature and a timestamp older than five minutes.
Also cover hook-secret suffixes that are empty, invalid base64 or shorter than 24 decoded bytes; both accepted `whsec_...` formats; NUL/TAB/DEL in brand/from/reply-to; a Supabase URL with path, query, fragment or userinfo; and redirects with userinfo, a mismatched port or `/auth-evil` against `/auth`.

- [ ] **Step 3: Executar os testes para confirmar a falha inicial**

Run:

```powershell
node --no-warnings --test tests/auth-email-contract.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `auth-email-contract.ts`.

- [ ] **Step 4: Implementar os tipos e o parser estrito do evento**

Create `supabase/functions/_shared/auth-email-contract.ts` with these public definitions:

```ts
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
  constructor(readonly code: string) {
    super(code);
    this.name = 'AuthEmailInputError';
  }
}

export function parseAuthEmailHookPayload(value: unknown): AuthEmailHookPayload;
```

Apply these exact rules inside the parser:

- Root, `user` and `email_data` must be plain objects.
- `user.id` must match a UUID and have at most 64 characters.
- Email fields must be trimmed, at most 254 characters, contain one `@`, and contain no ASCII control character in `U+0000–U+001F` or `U+007F`.
- `email_action_type` must be in `AUTH_EMAIL_ACTION_TYPES`.
- Required string fields must exist; empty token/hash fields remain allowed because notification events send them empty.
- Token, hash, redirect and metadata strings must each stay at or below 2,048 characters.
- The parser copies only declared fields into a new object; it never returns the original object.
- Errors expose only stable codes such as `invalid_payload`, `invalid_email` and `unsupported_action`.

- [ ] **Step 5: Implementar a configuração e a allowlist de redirect**

Create `supabase/functions/_shared/auth-email-config.ts`:

```ts
export type AuthEmailRuntimeConfig = {
  resendApiKey: string;
  hookSecret: string;
  brandName: string;
  fromAddress: string;
  replyTo?: string;
  allowedRedirectPrefixes: string[];
  supabaseUrl: string;
};

export class AuthEmailConfigurationError extends Error {
  constructor(readonly missingOrInvalidNames: string[]) {
    super('auth_email_configuration_invalid');
    this.name = 'AuthEmailConfigurationError';
  }
}

export function loadAuthEmailConfig(
  readEnv: (name: string) => string | undefined
): AuthEmailRuntimeConfig;

export function isAllowedAuthRedirect(value: string, prefixes: string[]): boolean;

export function formatResendFrom(brandName: string, address: string): string;
```

Implement these checks:

- Reject empty values and every ASCII control character in `U+0000–U+001F` or `U+007F` in all header-like settings.
- Require `RESEND_API_KEY` to start with `re_`, without logging the value.
- Normalize the optional `v1,` prefix, require the remaining `SEND_EMAIL_HOOK_SECRET` to be `whsec_` followed by canonical base64, and require 24–64 decoded bytes as specified by Standard Webhooks 1.0. Treat malformed secret material as `AuthEmailConfigurationError`, never as a request-level signature failure.
- Keep `EMAIL_BRAND_NAME` between 1 and 80 Unicode characters and reject ASCII controls plus address-list/display-name delimiters `<`, `>`, `"`, `\\`, `,` and `;`.
- Require mailbox-only values in `EMAIL_FROM_ADDRESS` and optional `EMAIL_REPLY_TO`; the transport formats `Brand <mailbox>`.
- Parse `EMAIL_ALLOWED_REDIRECT_PREFIXES` as a comma-separated, deduplicated list.
- Permit a custom scheme entry only in the exact form `<scheme>://`; permit web prefixes only over HTTPS.
- For HTTPS, reject username/password, compare exact parsed origin (scheme, host and port), and accept a path only when it equals the configured pathname or starts with `prefix.pathname + '/'` after removing one trailing slash. Thus `/auth-evil` never matches `/auth`. Never use raw hostname prefix matching.
- Accept an HTTP `SUPABASE_URL` only for `localhost` or `127.0.0.1`; require HTTPS elsewhere. Require a pure origin with a host, `/` pathname, and no username, password, query or fragment; return `url.origin` rather than stripping arbitrary trailing text.
- Return every missing/invalid variable name in `missingOrInvalidNames`, without its value.
- Make `formatResendFrom` the only code path that builds the Resend sender. It revalidates brand/address, then returns exactly `${brandName} <${address}>`; tests must cover the full config-to-transport value and reject ambiguous brand names.

- [ ] **Step 6: Implementar o adaptador Standard Webhooks**

Create `supabase/functions/_shared/auth-email-signature.ts`:

```ts
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
```

The adapter must pass the unmodified body and all headers to the library. Do not implement HMAC manually and do not weaken the library's five-minute timestamp tolerance.
Construct the `Webhook` outside the request-verification `try`: malformed key material is a server configuration defect and must not be converted into a client-facing 401. Normal execution receives only the secret already validated by `loadAuthEmailConfig`.

- [ ] **Step 7: Executar os testes do núcleo**

Run:

```powershell
node --no-warnings --test tests/auth-email-contract.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commitar o núcleo validado**

```powershell
git add package.json package-lock.json tests/auth-email-fixtures.ts tests/auth-email-contract.test.ts supabase/functions/_shared/auth-email-contract.ts supabase/functions/_shared/auth-email-config.ts supabase/functions/_shared/auth-email-signature.ts
git commit -m "feat: validate Supabase auth email hooks"
```

---

### Task 2: Planejamento de mensagens e templates

**Files:**

- Create: `supabase/functions/_shared/auth-email-plan.ts`
- Create: `supabase/functions/_shared/auth-email-template.ts`
- Create: `tests/auth-email-plan.test.ts`

**Interfaces:**

- Consumes: `AuthEmailHookPayload`, `AuthEmailActionType`, `AuthEmailRuntimeConfig` from Task 1.
- Produces: `AuthEmailMessagePlan`, `planAuthEmail(payload, config)`.
- Produces: `RenderedAuthEmail`, `renderAuthEmail(plan, brandName)`.
- Consumed by: Task 4 handler.

- [ ] **Step 1: Escrever testes falhos para a matriz completa**

Create `tests/auth-email-plan.test.ts`. Import `authEmailPayload` and `TEST_AUTH_EMAIL_CONFIG` from `tests/auth-email-fixtures.ts`, then loop over the accepted action types:

```ts
test('planeja todos os eventos publicados sem destinatário livre', () => {
  for (const actionType of AUTH_EMAIL_ACTION_TYPES) {
    const plans = planAuthEmail(authEmailPayload(actionType), TEST_AUTH_EMAIL_CONFIG);
    assert.ok(plans.length === 1 || (actionType === 'email_change' && plans.length === 2));
    for (const plan of plans) {
      assert.ok(['primary', 'current_email', 'new_email'].includes(plan.recipientRole));
      assert.doesNotMatch(plan.subject, /\r|\n/);
    }
  }
});

test('mapeia os hashes invertidos da mudança segura de e-mail', () => {
  const plans = planAuthEmail(authEmailPayload('email_change'), TEST_AUTH_EMAIL_CONFIG);
  assert.deepEqual(
    plans.map(({ to, token, tokenHash, recipientRole }) => ({
      to, token, tokenHash, recipientRole,
    })),
    [
      {
        to: 'pessoa@exemplo.com',
        token: '305805',
        tokenHash: 'hash-do-endereco-atual',
        recipientRole: 'current_email',
      },
      {
        to: 'novo@exemplo.com',
        token: '905409',
        tokenHash: 'hash-do-endereco-novo',
        recipientRole: 'new_email',
      },
    ]
  );
});

test('escapa conteúdo dinâmico e mantém alternativa em texto', () => {
  const [signupPlan] = planAuthEmail(
    authEmailPayload('signup'),
    TEST_AUTH_EMAIL_CONFIG
  );
  const rendered = renderAuthEmail(
    { ...signupPlan, title: '<script>alert(1)</script>' },
    'Marca <Teste>'
  );
  assert.doesNotMatch(rendered.html, /<script>/);
  assert.match(rendered.html, /&lt;script&gt;/);
  assert.match(rendered.html, /Marca &lt;Teste&gt;/);
  assert.match(rendered.text, /305805/);
  assert.doesNotMatch(rendered.html, /<img|tracking|pixel/i);
});
```

Add explicit cases for:

- `signup`, `email` and `reauthentication` with a six-digit code and no required click.
- `recovery`, `magiclink` and `invite` with a trusted verification URL.
- `email_change` secure with two messages and simple with one message to `new_email`.
- Simple `email_change` in both published payload shapes: `token + token_hash` and `token_new + token_hash`, asserting the exact recipient, token and hash.
- Seven notification events with no token or action URL.
- Missing active token/hash/new_email.
- Disallowed redirect and newline injection.
- URL query parameters encoded with `URLSearchParams`, including `redirect_to`.
- HTML and text containing the same title, safety message, code and visible URL when present.

- [ ] **Step 2: Executar os testes para confirmar a falha inicial**

Run:

```powershell
node --no-warnings --test tests/auth-email-plan.test.ts
```

Expected: FAIL with missing `auth-email-plan.ts`.

- [ ] **Step 3: Implementar os tipos e a matriz de mensagens**

Create `supabase/functions/_shared/auth-email-plan.ts` with this contract:

```ts
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

export function buildAuthVerificationUrl(input: {
  supabaseUrl: string;
  tokenHash: string;
  actionType: AuthEmailActionType;
  redirectTo: string;
  allowedRedirectPrefixes: string[];
}): string;

export function planAuthEmail(
  payload: AuthEmailHookPayload,
  config: AuthEmailRuntimeConfig
): AuthEmailMessagePlan[];
```

Use this exact Portuguese copy matrix. Prefix subjects with `${brandName}: ` only during planning, after validating the brand:

| Action | Subject suffix | Title | CTA/code |
| --- | --- | --- | --- |
| `signup` | `confirme seu e-mail` | `Confirme seu e-mail` | code |
| `email` | `seu código de acesso` | `Acesse sua conta` | code |
| `recovery` | `redefina sua senha` | `Redefina sua senha` | `Criar nova senha` |
| `magiclink` | `seu link de acesso` | `Acesse sua conta` | `Entrar na conta` plus code |
| `invite` | `você recebeu um convite` | `Aceite seu convite` | `Aceitar convite` |
| `reauthentication` | `confirme esta ação` | `Confirme sua identidade` | code |
| `email_change` | `confirme a alteração de e-mail` | role-specific confirmation | `Confirmar alteração` plus code |
| `password_changed_notification` | `sua senha foi alterada` | `Senha alterada` | none |
| `email_changed_notification` | `seu e-mail foi alterado` | `E-mail alterado` | none |
| `phone_changed_notification` | `seu telefone foi alterado` | `Telefone alterado` | none |
| `identity_linked_notification` | `novo acesso vinculado` | `Identidade vinculada` | none |
| `identity_unlinked_notification` | `acesso removido` | `Identidade removida` | none |
| `mfa_factor_enrolled_notification` | `verificação em duas etapas ativada` | `Fator de segurança adicionado` | none |
| `mfa_factor_unenrolled_notification` | `verificação em duas etapas alterada` | `Fator de segurança removido` | none |

Use the same safety notice for action messages: `Se você não solicitou esta ação, ignore este e-mail e não compartilhe o código ou o link.` Security notifications use: `Se você não reconhece esta alteração, redefina sua senha e revise os acessos à sua conta.`

Build verification URLs only for link-capable actions. Detect secure email change only when `token_hash_new` is non-empty: send the current-address message with `token + token_hash_new`, then the new-address message with `token_new + token_hash`. Reject the entire secure event if either message lacks its recipient, token or hash.

When `token_hash_new` is empty, handle simple email change as exactly one message to `user.new_email` using `token_hash`. Accept both official token shapes by selecting non-empty `token_new` first and otherwise `token`; reject the event if neither exists. Never use `token_hash_new` or the current address in simple mode. Add a parameterized test for both `{ token, token_new: '' }` and `{ token: '', token_new }`.

Validate every non-empty `redirect_to` against `allowedRedirectPrefixes` before selecting the action branch, including code-only and notification events. Empty redirects are allowed only for events that do not construct an action URL. Always build `/auth/v1/verify` from `config.supabaseUrl`; never trust `email_data.site_url` as the provider origin.

- [ ] **Step 4: Implementar o renderer sem dependência de React**

Create `supabase/functions/_shared/auth-email-template.ts`:

```ts
export type RenderedAuthEmail = { html: string; text: string };

export function escapeEmailHtml(value: string): string;

export function renderAuthEmail(
  plan: AuthEmailMessagePlan,
  brandName: string
): RenderedAuthEmail;
```

The HTML must be a complete `<!doctype html>` document with `lang="pt-BR"`, a presentation table, maximum inner width of 560 px, inline styles, a text button when `actionUrl` exists, a large monospace code block when `token` exists, and the visible escaped URL below the button. Set `role="presentation"` on layout tables. Do not include `img`, remote CSS, JavaScript, forms, tracking parameters or hidden pixels.

Build text with blank-line-separated sections in this order: brand, title, introduction, code, action label plus URL, safety notice. Omit absent sections rather than emitting `undefined`.

- [ ] **Step 5: Executar os testes de planejamento e template**

Run:

```powershell
node --no-warnings --test tests/auth-email-plan.test.ts
```

Expected: PASS for the full event matrix.

- [ ] **Step 6: Commitar mensagens e templates**

```powershell
git add tests/auth-email-plan.test.ts supabase/functions/_shared/auth-email-plan.ts supabase/functions/_shared/auth-email-template.ts
git commit -m "feat: render Supabase auth emails"
```

---

### Task 3: Transporte HTTP do Resend

**Files:**

- Create: `supabase/functions/_shared/resend-email.ts`
- Create: `tests/resend-email.test.ts`

**Interfaces:**

- Consumes: planned and rendered message fields from Task 2.
- Produces: `OutboundAuthEmail`, `EmailTransport`, `ResendTransportError`, `createResendEmailTransport(options)`, `authEmailIdempotencyKey(...)`.
- Consumed by: Task 4 handler and entrypoint.

- [ ] **Step 1: Escrever testes falhos do contrato HTTP**

Create `tests/resend-email.test.ts` using these local fixtures and a fake `fetch` that records URL and `RequestInit`:

```ts
const outboundEmail: OutboundAuthEmail = {
  actionType: 'signup',
  recipientRole: 'primary',
  to: 'pessoa@exemplo.com',
  subject: 'Marca de Teste: confirme seu e-mail',
  html: '<!doctype html><html><body>305805</body></html>',
  text: 'Seu código: 305805',
};

async function sendWithStatus(
  status: number,
  providerName = 'provider_error'
): Promise<{ id: string }> {
  const transport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    fetchImpl: async () => Response.json(
      status >= 200 && status < 300
        ? { id: 'email_123' }
        : { name: providerName, message: 'must not escape the adapter' },
      { status }
    ),
  });
  return transport.send(outboundEmail, 'auth/signup/primary/msg_auth_001');
}
```

Then add the contract assertions:

```ts
test('envia corpo, remetente e idempotência sem expor a chave', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const transport = createResendEmailTransport({
    apiKey: 're_private_test',
    from: 'Marca de Teste <conta@email.exemplo.com>',
    replyTo: 'suporte@exemplo.com',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ id: 'email_123' }, { status: 200 });
    },
  });
  const result = await transport.send(outboundEmail, 'auth/signup/primary/msg_auth_001');
  assert.equal(result.id, 'email_123');
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get('Authorization'), 'Bearer re_private_test');
  assert.equal(headers.get('Idempotency-Key'), 'auth/signup/primary/msg_auth_001');
  assert.equal(headers.get('User-Agent'), 'auth-email-hook/1.0');
  assert.doesNotMatch(JSON.stringify(await result), /re_private_test/);
});

test('classifica somente falhas seguramente repetíveis como transitórias', async () => {
  for (const status of [429, 500, 503]) {
    await assert.rejects(sendWithStatus(status), (error: unknown) =>
      error instanceof ResendTransportError && error.kind === 'transient'
    );
  }
  for (const status of [400, 401, 403, 404, 422]) {
    await assert.rejects(sendWithStatus(status), (error: unknown) =>
      error instanceof ResendTransportError && error.kind === 'permanent'
    );
  }
  await assert.rejects(
    sendWithStatus(409, 'concurrent_idempotent_requests'),
    (error: unknown) => error instanceof ResendTransportError && error.kind === 'transient'
  );
  await assert.rejects(
    sendWithStatus(409, 'invalid_idempotent_request'),
    (error: unknown) => error instanceof ResendTransportError && error.kind === 'permanent'
  );
});
```

Add cases for network exception, 10-second abort, malformed success response, missing response ID, optional reply-to omission, `text` and `html` together, safe tags, maximum 256-character key, webhook IDs with dots/control characters and absence of raw Resend error message in thrown errors.

- [ ] **Step 2: Executar o teste para confirmar a falha inicial**

Run:

```powershell
node --no-warnings --test tests/resend-email.test.ts
```

Expected: FAIL with missing `resend-email.ts`.

- [ ] **Step 3: Implementar o transporte e a classificação de erros**

Create `supabase/functions/_shared/resend-email.ts` with:

```ts
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
  constructor(
    readonly kind: 'transient' | 'permanent',
    readonly status?: number,
    readonly providerCode?: string
  ) {
    super('resend_transport_failed');
    this.name = 'ResendTransportError';
  }
}

export function authEmailIdempotencyKey(input: {
  webhookId: string;
  actionType: AuthEmailActionType;
  recipientRole: AuthEmailRecipientRole;
}): string;

export function createResendEmailTransport(options: {
  apiKey: string;
  from: string;
  replyTo?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): EmailTransport;
```

Implement `authEmailIdempotencyKey` as `auth/<actionType>/<recipientRole>/<webhookId>`. Accept webhook IDs only when they match `^[A-Za-z0-9_-]{1,128}$`; enforce the Resend maximum of 256 characters.

The transport must:

- Send `POST https://api.resend.com/emails` over the injected `fetchImpl`.
- Set `Authorization`, `Content-Type: application/json`, `User-Agent: auth-email-hook/1.0` and `Idempotency-Key`.
- Send `{ from, to: [message.to], subject, html, text, reply_to?, tags }`.
- Use tags `{ name: 'auth_event', value: actionType }` and `{ name: 'recipient_role', value: recipientRole }`; both values satisfy Resend's ASCII tag rules.
- Abort after 10,000 ms with an internal `AbortController`; clear the timer in `finally`.
- Parse only a success `id` matching `^[A-Za-z0-9_-]{1,128}$` and a sanitized error `name` matching `^[a-z0-9_-]{1,80}$`; discard provider messages and raw bodies.
- Treat network/abort, 429, 5xx and only a 409 named `concurrent_idempotent_requests` as transient. Treat `invalid_idempotent_request`, unknown/missing 409 names, remaining non-2xx and malformed 2xx responses as permanent; retrying the same mismatched idempotency key cannot recover.
- Never include API key, recipient, subject, HTML, text or raw provider response in an exception.

- [ ] **Step 4: Executar os testes do transporte**

Run:

```powershell
node --no-warnings --test tests/resend-email.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commitar o transporte**

```powershell
git add tests/resend-email.test.ts supabase/functions/_shared/resend-email.ts
git commit -m "feat: send auth emails through Resend API"
```

---

### Task 4: Handler HTTP e entrypoint da Edge Function

**Files:**

- Create: `supabase/functions/_shared/auth-email-handler.ts`
- Create: `supabase/functions/send-auth-email/index.ts`
- Create: `supabase/functions/send-auth-email/deno.json`
- Create: `tests/auth-email-handler.test.ts`
- Modify: `supabase/config.toml`

**Interfaces:**

- Consumes: every public interface produced by Tasks 1–3.
- Produces: `AuthEmailLogEntry`, `AuthEmailHandlerDependencies`, `createAuthEmailHandler(dependencies)`.
- Entrypoint: `Deno.serve(createAuthEmailHandler(...))`.

- [ ] **Step 1: Escrever testes falhos do handler**

Create `tests/auth-email-handler.test.ts`. Import `authEmailPayload`, `signedAuthEmailRequest`, `TEST_AUTH_EMAIL_CONFIG`, `TEST_HOOK_SECRET` and `TEST_WEBHOOK_ID` from `tests/auth-email-fixtures.ts`. Build the system under test with explicit fakes:

```ts
const sent: Array<{ message: OutboundAuthEmail; idempotencyKey: string }> = [];
const logs: AuthEmailLogEntry[] = [];
const transport: EmailTransport = {
  async send(message, idempotencyKey) {
    sent.push({ message, idempotencyKey });
    return { id: `email_${sent.length}` };
  },
};
const handler = createAuthEmailHandler({
  loadConfig: () => TEST_AUTH_EMAIL_CONFIG,
  verifyHook: verifyAuthEmailHook,
  createTransport: () => transport,
  logger: (entry) => logs.push(entry),
});

function requestWith(input: {
  method?: string;
  body?: string;
  headers?: HeadersInit;
} = {}): Request {
  const method = input.method ?? 'POST';
  return new Request('http://localhost/functions/v1/send-auth-email', {
    method,
    headers: input.headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : (input.body ?? ''),
  });
}

const signedRequest = (
  payloadOrRawBody: unknown | string,
  options?: Parameters<typeof signedAuthEmailRequest>[1]
) => signedAuthEmailRequest(payloadOrRawBody, options);
const unknownPayload = {
  ...authEmailPayload('signup'),
  email_data: {
    ...authEmailPayload('signup').email_data,
    email_action_type: 'future_event',
  },
};
```

Reset `sent` and `logs` in `beforeEach`. For failure-path tests, construct a fresh handler with the one dependency overridden so each status has a single cause. Cover this response table:

```ts
const cases = [
  { name: 'método', request: requestWith({ method: 'GET' }), status: 405 },
  { name: 'assinatura ausente', request: requestWith({ headers: {} }), status: 401 },
  { name: 'corpo excessivo', request: requestWith({ body: 'x'.repeat(65_537) }), status: 413 },
  { name: 'json assinado inválido', request: signedRequest('{'), status: 422 },
  { name: 'evento desconhecido', request: signedRequest(unknownPayload), status: 422 },
];

for (const item of cases) {
  test(`retorna ${item.status} para ${item.name}`, async () => {
    const response = await handler(item.request);
    assert.equal(response.status, item.status);
  });
}
```

Add assertions for:

- `Allow: POST` on 405.
- Early `Content-Length > 65536` and streamed body crossing 64 KiB.
- Invalid UTF-8 bytes return 422 `invalid_payload` before verifier or transport invocation.
- No payload parse or transport call after invalid signature.
- Configuration error returns 500 and logs only variable names.
- Success returns status 200 and `{}` after Resend acceptance.
- Permanent transport error returns 502; transient error returns 503.
- Secure email change sends in deterministic current/new order with distinct idempotency keys.
- Partial acceptance returns 503 and logs only accepted Resend IDs.
- Collected logs do not match the fixture email, OTP, token hash, `kad://`, HTML, API key or hook secret.
- Public response bodies contain only `{ error: '<stable_code>' }` or `{}`.

- [ ] **Step 2: Executar os testes para confirmar as falhas**

Run:

```powershell
node --no-warnings --test tests/auth-email-handler.test.ts
```

Expected: FAIL because the handler does not exist.

- [ ] **Step 3: Implementar leitura limitada do corpo e orquestração**

Create `supabase/functions/_shared/auth-email-handler.ts`:

```ts
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

export function createAuthEmailHandler(
  dependencies: AuthEmailHandlerDependencies
): (request: Request) => Promise<Response>;
```

Implement a private `readBodyWithLimit(request, 65_536)` that:

- Rejects an integer `Content-Length` above the limit before reading.
- Reads `request.body` through `getReader()` and counts bytes, not JavaScript characters.
- Cancels the reader when the accumulated size exceeds the limit.
- Concatenates accepted chunks and decodes them once with fatal UTF-8 decoding.
- Returns an empty string for a missing body; the verifier then rejects it.

Use a private typed body-read error that distinguishes `payload_too_large` from `invalid_payload`. Convert `TextDecoder` failures to `invalid_payload`; never let invalid UTF-8 fall into the generic 500 path.

Handler order must be:

1. Capture start time.
2. Reject non-POST with 405 and `Allow: POST`.
3. Read the body with the byte limit; return 413 on overflow and 422 on invalid UTF-8.
4. Load server configuration; return 500 on `AuthEmailConfigurationError`.
5. Collect lowercase headers and verify the unmodified body before parsing.
6. Map signature failures to 401 and signed JSON syntax/contract failures to 422.
7. Validate `webhook-id` for idempotency.
8. Plan and render messages.
9. Build the transport and send messages sequentially.
10. Log safe structured fields and return `{}` with 200 only after every message is accepted.

Map `ResendTransportError('permanent')` to 502 and transient to 503. Map unexpected internal failures to 500 with `internal_error`. `invalidConfigNames` may contain only canonical names from the fixed environment-variable allowlist. Logging code must construct an allowlisted object; never spread an error, payload, config or provider response.

- [ ] **Step 4: Criar o entrypoint mínimo e import map Deno**

Create `supabase/functions/send-auth-email/deno.json`:

```json
{
  "imports": {
    "standardwebhooks": "npm:standardwebhooks@1.0.0"
  },
  "compilerOptions": {
    "lib": ["deno.ns", "dom", "dom.iterable", "esnext"]
  }
}
```

Create `supabase/functions/send-auth-email/index.ts` with only composition:

```ts
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
```

Do not add CORS headers: this is a server-to-server hook and the browser never calls it.

- [ ] **Step 5: Configurar o endpoint assinado sem JWT**

Append to `supabase/config.toml` without altering the existing Mercado Pago section:

```toml

[functions.send-auth-email]
verify_jwt = false
```

- [ ] **Step 6: Executar os testes comportamentais do handler**

Run:

```powershell
node --no-warnings --test tests/auth-email-handler.test.ts
```

Expected: PASS.

- [ ] **Step 7: Validar o grafo TypeScript e as configurações sem teste de texto**

Run:

```powershell
npx.cmd --yes deno@2.9.5 check --config supabase/functions/send-auth-email/deno.json supabase/functions/send-auth-email/index.ts
npx.cmd --yes deno@2.9.5 eval --allow-read "import { parse } from 'jsr:@std/toml@1.0.11'; const c = parse(await Deno.readTextFile('supabase/config.toml')) as Record<string, unknown>; const f = c.functions as Record<string, { verify_jwt?: boolean }> | undefined; if (f?.['send-auth-email']?.verify_jwt !== false) throw new Error('send-auth-email verify_jwt must be false');"
npx.cmd --yes supabase@2.114.0 functions serve --help
```

Expected: Deno check exits 0; the pinned TOML parser reads `config.toml` and verifies the semantic value; Supabase CLI recognizes the local `functions serve` command and `--no-verify-jwt` option. These commands do not start services or mutate a remote project. Do not run `supabase functions deploy`.

- [ ] **Step 8: Commitar a Edge Function completa**

```powershell
git add tests/auth-email-handler.test.ts supabase/config.toml supabase/functions/_shared/auth-email-handler.ts supabase/functions/send-auth-email/index.ts supabase/functions/send-auth-email/deno.json
git commit -m "feat: add signed auth email Edge Function"
```

---

### Task 5: Guia operacional e proteção contra ativação acidental

**Files:**

- Create: `docs/EMAILS.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: final environment variable names, function slug and response behavior.
- Produces: an activation and rollback runbook; no runtime API.

- [ ] **Step 1: Escrever o guia de ativação sem inserir credenciais**

This human-facing runbook is explicitly exempted from automated source-text tests by the project owner. Verify its content through the task review and the credential scan below.

Create `docs/EMAILS.md` with these exact sections:

1. `Escopo e estado atual`: code ready, remote hook disabled, no real delivery claimed.
2. `Arquitetura`: `Supabase Auth -> signed hook -> send-auth-email -> Resend API`.
3. `Segredos`: list the seven variable names and explain that only Supabase Edge Function Secrets may hold values.
4. `Domínio e remetente`: recommend a sending subdomain, SPF, DKIM, DMARC `p=none` first, sending-only scoped key, and disabled open/click tracking.
5. `Validação antes da ativação`: Deno check, automated tests, Resend controlled recipient, Gmail/Outlook rendering and link checks.
6. `Ativação sem janela de falha`: configure first every non-hook secret and deploy the function; open the HTTPS Send Email Hook form and generate/copy its secret without saving/enabling; set `SEND_EMAIL_HOOK_SECRET` from a separate terminal; run a controlled signed canary; only then save/enable the hook and test signup/resend/recovery/security notification. Explain that an enabled hook replaces the built-in SMTP path. If the Dashboard cannot separate secret generation from saving, require a controlled maintenance window, confirmed fallback SMTP and immediate rollback readiness before creating it.
7. `Rollback`: disable the hook while keeping the Supabase email provider enabled; confirm fallback SMTP before declaring recovery.
8. `Rotação`: create a new Resend key, update secret, verify, then revoke old key; rotate the hook secret through a controlled maintenance window.
9. `Privacidade e logs`: prohibited fields and current lack of delivery webhooks/outbox.

The secret example block must contain variable names with `<defina-no-painel>` values, never strings that resemble real Resend or webhook credentials. State that `resend.dev` is restricted to controlled account testing and must not be used for end users.

- [ ] **Step 2: Linkar o guia no README**

Add a short `## E-mails de autenticação` section after `## Autenticação e banco`:

```md
## E-mails de autenticação

O projeto possui uma Edge Function preparada para encaminhar e-mails do Supabase Auth
à API do Resend. A função permanece desativada até a marca e o domínio de envio serem
definidos e verificados. Consulte [`docs/EMAILS.md`](docs/EMAILS.md) antes de configurar
segredos, publicar a função ou habilitar o Send Email Hook.
```

- [ ] **Step 3: Revisar conteúdo e procurar credenciais**

Run:

```powershell
git diff --check
rg -n 're_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9+/=]{16,}|service_role|EXPO_PUBLIC_RESEND|Authorization:\s*Bearer\s+re_' docs/EMAILS.md README.md
```

Expected: `git diff --check` has no output. Review every `rg` match; the new email documentation must contain no credential-like value, `service_role`, client-side Resend variable or hardcoded Bearer key. The task reviewer must verify all nine required sections, activation order and rollback language from the brief.

- [ ] **Step 4: Commitar a documentação operacional**

```powershell
git add README.md docs/EMAILS.md
git commit -m "docs: document Resend auth email activation"
```

---

### Task 6: Verificação integral, segurança e entrega do Pull Request

**Files:**

- Review: all files changed since `origin/main`.
- Modify only if a verification or review produces an actionable defect.

**Interfaces:**

- Consumes: completed implementation from Tasks 1–5.
- Produces: verified branch and draft Pull Request; no merge and no remote Supabase mutation.

- [ ] **Step 1: Executar todos os testes específicos em uma única chamada**

Run:

```powershell
node --no-warnings --test tests/auth-email-contract.test.ts tests/auth-email-plan.test.ts tests/resend-email.test.ts tests/auth-email-handler.test.ts
```

Expected: all tests pass, 0 failures.

- [ ] **Step 2: Executar o gate obrigatório do repositório**

Run:

```powershell
npm.cmd run check
```

Expected: test, typecheck and lint exit 0.

- [ ] **Step 3: Repetir o typecheck da função no runtime alvo**

Run:

```powershell
npx.cmd --yes deno@2.9.5 check --config supabase/functions/send-auth-email/deno.json supabase/functions/send-auth-email/index.ts
```

Expected: exit 0.

- [ ] **Step 4: Procurar credenciais e padrões proibidos no diff**

Run:

```powershell
git diff --check origin/main...HEAD
git diff --name-only origin/main...HEAD
rg -n --hidden -g '!node_modules' -g '!.git' 're_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9+/=]{16,}|service_role|EXPO_PUBLIC_RESEND|Authorization:\s*Bearer\s+re_' README.md docs supabase tests package.json
```

Expected: `git diff --check` has no output. The secret scan may find documentation words such as `service_role`, but it must find no credential-like value, hardcoded Bearer key, or client-side Resend variable. Review every match manually.

- [ ] **Step 5: Executar revisão de segurança do diff**

Invoke `codex-security:security-diff-scan` against `origin/main...HEAD`. Validate these paths explicitly:

- Signature verification occurs before JSON contract parsing.
- Body size is enforced while streaming.
- Redirect comparison resists lookalike hosts and scheme abuse.
- Header values reject CR/LF.
- Recipients come only from validated fields in the signed hook and are selected by the fixed event matrix; sender and subject are config/matrix controlled, while escaped dynamic content cannot become HTML markup.
- API and hook keys remain server-only.
- Idempotency keys contain no PII and remain stable for retry.
- Logs and public errors contain no sensitive payload fields.
- `verify_jwt = false` is scoped only to the signed hook.

If findings are reportable, invoke `codex-security:fix-finding`, add regression tests, rerun Steps 1–5 and commit with `fix: harden auth email integration`.

- [ ] **Step 6: Solicitar revisão de código independente**

Invoke `superpowers:requesting-code-review` with the approved spec, this plan and `origin/main...HEAD`. Resolve actionable findings with tests and repeat the full verification.

- [ ] **Step 7: Confirmar escopo e estado Git**

Run:

```powershell
git status --short --branch
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: clean worktree; commits limited to the design, implementation, tests and email documentation. No payment pending file or payment-branch-only commit appears.

- [ ] **Step 8: Push e Pull Request sem merge**

Use `superpowers:finishing-a-development-branch`. Push `codex/integrate-resend-auth-email` and open a draft Pull Request targeting `main` with:

- Summary of signed Supabase Auth hook, complete event matrix, templates and Resend transport.
- Security notes: server-only secrets, Standard Webhooks, redirect allowlist, body limit, idempotency and redacted logs.
- Verification commands and exact outcomes.
- Explicit deployment status: no function deployed, no secret created, hook disabled, no real email sent.
- Activation prerequisite: final brand plus verified domain/subdomain.

Do not merge the Pull Request.

## Completion evidence

The final handoff must include:

- Pull Request URL and branch name.
- Commit list.
- Specific and full test counts.
- Deno check result.
- Security scan result and fixed finding references, if any.
- Confirmation that the main payment worktree was untouched.
- The remaining external activation steps from `docs/EMAILS.md`.
