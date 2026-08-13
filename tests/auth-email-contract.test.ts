import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { Webhook } from 'standardwebhooks';

import {
  AUTH_EMAIL_ACTION_TYPES,
  parseAuthEmailHookPayload,
} from '../supabase/functions/_shared/auth-email-contract.ts';
import {
  AuthEmailConfigurationError,
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

const validSecret = `whsec_${Buffer.from('segredo-de-teste-com-32-bytes!!').toString('base64')}`;

function validEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    RESEND_API_KEY: 're_test_key',
    SEND_EMAIL_HOOK_SECRET: `v1,${validSecret}`,
    EMAIL_BRAND_NAME: 'Marca de Teste',
    EMAIL_FROM_ADDRESS: 'conta@email.exemplo.com',
    EMAIL_REPLY_TO: 'suporte@exemplo.com',
    EMAIL_ALLOWED_REDIRECT_PREFIXES: 'kad://,https://app.exemplo.com/auth/',
    SUPABASE_URL: 'https://projeto.supabase.co',
    ...overrides,
  };
}

function loadWith(values: Record<string, string | undefined>) {
  return loadAuthEmailConfig((name) => values[name]);
}

function expectInvalidConfiguration(
  values: Record<string, string | undefined>,
  names: string[]
) {
  assert.throws(
    () => loadWith(values),
    (error) => {
      assert.ok(error instanceof AuthEmailConfigurationError);
      assert.deepEqual(error.missingOrInvalidNames, names);
      return true;
    }
  );
}

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

test('normaliza os e-mails do usuário antes de copiar o evento', () => {
  const parsed = parseAuthEmailHookPayload({
    ...validPayload,
    user: {
      ...validPayload.user,
      email: '  pessoa@exemplo.com  ',
      new_email: '  novo@exemplo.com  ',
    },
  });
  assert.equal(parsed.user.email, 'pessoa@exemplo.com');
  assert.equal(parsed.user.new_email, 'novo@exemplo.com');
});

test('recusa old_email inválido ou com quebra de cabeçalho', () => {
  for (const oldEmail of ['sem-arroba', 'anterior@exemplo.com\r\nBcc: atacante@exemplo.com']) {
    assert.throws(() => parseAuthEmailHookPayload({
      ...validPayload,
      email_data: { ...validPayload.email_data, old_email: oldEmail },
    }), /invalid_email/);
  }
});

test('recusa controles ASCII no início ou fim dos e-mails', () => {
  for (const email of ['\tpessoa@exemplo.com', 'pessoa@exemplo.com\u007f']) {
    assert.throws(() => parseAuthEmailHookPayload({
      ...validPayload,
      user: { ...validPayload.user, email },
    }), /invalid_email/);
  }
});

test('copia somente o evento válido declarado e mantém tokens vazios de notificação', () => {
  const parsed = parseAuthEmailHookPayload({
    ...validPayload,
    ignored: 'não deve vazar',
    user: { ...validPayload.user, ignored: true },
    email_data: { ...validPayload.email_data, ignored: true },
  });
  assert.deepEqual(parsed, validPayload);
  assert.notEqual(parsed, validPayload);
  assert.notEqual(parsed.user, validPayload.user);
  assert.notEqual(parsed.email_data, validPayload.email_data);
});

test('recusa estruturas e strings do evento fora do contrato', () => {
  assert.throws(() => parseAuthEmailHookPayload([]), /invalid_payload/);
  assert.throws(() => parseAuthEmailHookPayload({ ...validPayload, user: new Date() }), /invalid_payload/);
  assert.throws(() => parseAuthEmailHookPayload({
    ...validPayload,
    user: { ...validPayload.user, id: 'não-é-uuid' },
  }), /invalid_payload/);
  assert.throws(() => parseAuthEmailHookPayload({
    ...validPayload,
    email_data: { ...validPayload.email_data, token: 'x'.repeat(2049) },
  }), /invalid_payload/);
});

test('carrega somente configuração server-side válida', () => {
  const config = loadWith(validEnvironment());
  assert.deepEqual(config, {
    resendApiKey: 're_test_key',
    hookSecret: validSecret,
    brandName: 'Marca de Teste',
    fromAddress: 'conta@email.exemplo.com',
    replyTo: 'suporte@exemplo.com',
    allowedRedirectPrefixes: ['kad://', 'https://app.exemplo.com/auth/'],
    supabaseUrl: 'https://projeto.supabase.co',
  });
  assert.equal(
    formatResendFrom(config.brandName, config.fromAddress),
    'Marca de Teste <conta@email.exemplo.com>'
  );
  assert.equal(Object.hasOwn(config, 'EXPO_PUBLIC_RESEND_API_KEY'), false);
});

test('reporta todos os nomes de configuração ausentes ou inválidos sem valores', () => {
  expectInvalidConfiguration(validEnvironment({
    RESEND_API_KEY: '',
    SEND_EMAIL_HOOK_SECRET: undefined,
    EMAIL_BRAND_NAME: '',
    EMAIL_FROM_ADDRESS: 'sem-arroba',
    EMAIL_REPLY_TO: 'também-inválido',
    EMAIL_ALLOWED_REDIRECT_PREFIXES: '',
    SUPABASE_URL: 'http://projeto.supabase.co',
  }), [
    'RESEND_API_KEY',
    'SEND_EMAIL_HOOK_SECRET',
    'EMAIL_BRAND_NAME',
    'EMAIL_FROM_ADDRESS',
    'EMAIL_REPLY_TO',
    'EMAIL_ALLOWED_REDIRECT_PREFIXES',
    'SUPABASE_URL',
  ]);
});

test('recusa segredos de hook inválidos e aceita os dois formatos whsec', () => {
  for (const secret of [
    'v1,whsec_',
    'whsec_not-base64!',
    'whsec_aA',
    `whsec_${Buffer.from('curto').toString('base64')}`,
  ]) {
    expectInvalidConfiguration(validEnvironment({ SEND_EMAIL_HOOK_SECRET: secret }), [
      'SEND_EMAIL_HOOK_SECRET',
    ]);
  }
  assert.equal(loadWith(validEnvironment({ SEND_EMAIL_HOOK_SECRET: validSecret })).hookSecret, validSecret);
  assert.equal(loadWith(validEnvironment({ SEND_EMAIL_HOOK_SECRET: `v1,${validSecret}` })).hookSecret, validSecret);
});

test('recusa cabeçalhos e mailboxes ambíguos antes de formatar o remetente', () => {
  for (const [name, value] of [
    ['EMAIL_BRAND_NAME', 'Marca\tTeste'],
    ['EMAIL_BRAND_NAME', 'Marca <Teste>'],
    ['EMAIL_FROM_ADDRESS', 'conta@email.exemplo.com\u007f'],
    ['EMAIL_FROM_ADDRESS', 'Marca <conta@email.exemplo.com>'],
    ['EMAIL_REPLY_TO', 'suporte@exemplo.com\0'],
  ] as const) {
    expectInvalidConfiguration(validEnvironment({ [name]: value }), [name]);
  }
  assert.throws(() => formatResendFrom('Marca, Inc.', 'conta@email.exemplo.com'));
  assert.throws(() => formatResendFrom('Marca', 'Marca <conta@email.exemplo.com>'));
});

test('valida uma URL do Supabase como origem pura e permite HTTP apenas local', () => {
  for (const supabaseUrl of [
    'https://usuario:senha@projeto.supabase.co',
    'https://projeto.supabase.co/caminho',
    'https://projeto.supabase.co?query=1',
    'https://projeto.supabase.co#fragmento',
  ]) {
    expectInvalidConfiguration(validEnvironment({ SUPABASE_URL: supabaseUrl }), ['SUPABASE_URL']);
  }
  assert.equal(loadWith(validEnvironment({ SUPABASE_URL: 'http://localhost:54321' })).supabaseUrl, 'http://localhost:54321');
  assert.equal(loadWith(validEnvironment({ SUPABASE_URL: 'http://127.0.0.1:54321' })).supabaseUrl, 'http://127.0.0.1:54321');
});

test('compara origem e limite de caminho sem aceitar domínio parecido', () => {
  const allowed = ['kad://', 'https://app.exemplo.com/auth/'];
  assert.equal(isAllowedAuthRedirect('kad://auth/nova-senha', allowed), true);
  assert.equal(isAllowedAuthRedirect('https://app.exemplo.com/auth/login', allowed), true);
  assert.equal(isAllowedAuthRedirect('https://app.exemplo.com/auth', allowed), true);
  assert.equal(isAllowedAuthRedirect('https://app.exemplo.com.evil/auth/login', allowed), false);
  assert.equal(isAllowedAuthRedirect('https://usuario@app.exemplo.com/auth/login', allowed), false);
  assert.equal(isAllowedAuthRedirect('https://app.exemplo.com:8443/auth/login', allowed), false);
  assert.equal(isAllowedAuthRedirect('https://app.exemplo.com/auth-evil', allowed), false);
  assert.equal(isAllowedAuthRedirect('javascript:alert(1)', allowed), false);
});

test('recusa uma allowlist de redirecionamento vazia ou prefixos fora do formato', () => {
  expectInvalidConfiguration(validEnvironment({ EMAIL_ALLOWED_REDIRECT_PREFIXES: ' , ' }), [
    'EMAIL_ALLOWED_REDIRECT_PREFIXES',
  ]);
  expectInvalidConfiguration(validEnvironment({ EMAIL_ALLOWED_REDIRECT_PREFIXES: 'kad://auth,https://app.exemplo.com/auth' }), [
    'EMAIL_ALLOWED_REDIRECT_PREFIXES',
  ]);
});

test('valida assinatura, timestamp e corpo bruto', () => {
  const rawBody = JSON.stringify(validPayload);
  const webhook = new Webhook(validSecret);
  const timestamp = new Date();
  const headers = {
    'webhook-id': 'msg_auth_001',
    'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
    'webhook-signature': webhook.sign('msg_auth_001', timestamp, rawBody),
  };
  assert.deepEqual(verifyAuthEmailHook(rawBody, headers, `v1,${validSecret}`), validPayload);
  assert.throws(
    () => verifyAuthEmailHook(`${rawBody} `, headers, `v1,${validSecret}`),
    /invalid_signature/
  );
});

test('recusa cabeçalhos ausentes, assinatura inválida e timestamp expirado', () => {
  const rawBody = JSON.stringify(validPayload);
  const timestamp = new Date();
  const webhook = new Webhook(validSecret);
  const headers = {
    'webhook-id': 'msg_auth_001',
    'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
    'webhook-signature': webhook.sign('msg_auth_001', timestamp, rawBody),
  };
  for (const name of ['webhook-id', 'webhook-timestamp', 'webhook-signature']) {
    const incomplete = { ...headers };
    delete incomplete[name as keyof typeof incomplete];
    assert.throws(() => verifyAuthEmailHook(rawBody, incomplete, validSecret), /invalid_signature/);
  }
  assert.throws(
    () => verifyAuthEmailHook(rawBody, { ...headers, 'webhook-signature': 'v1,bad' }, validSecret),
    /invalid_signature/
  );
  const expiredAt = new Date(Date.now() - 6 * 60 * 1000);
  const expiredHeaders = {
    'webhook-id': 'msg_auth_001',
    'webhook-timestamp': String(Math.floor(expiredAt.getTime() / 1000)),
    'webhook-signature': webhook.sign('msg_auth_001', expiredAt, rawBody),
  };
  assert.throws(() => verifyAuthEmailHook(rawBody, expiredHeaders, validSecret), /invalid_signature/);
});
