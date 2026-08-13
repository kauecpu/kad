import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTH_EMAIL_ACTION_TYPES,
  AuthEmailInputError,
} from '../supabase/functions/_shared/auth-email-contract.ts';
import {
  buildAuthVerificationUrl,
  planAuthEmail,
} from '../supabase/functions/_shared/auth-email-plan.ts';
import { renderAuthEmail } from '../supabase/functions/_shared/auth-email-template.ts';
import {
  authEmailPayload,
  TEST_AUTH_EMAIL_CONFIG,
} from './auth-email-fixtures.ts';

const ACTION_SAFETY_NOTICE = 'Se você não solicitou esta ação, ignore este e-mail e não compartilhe o código ou o link.';
const SECURITY_SAFETY_NOTICE = 'Se você não reconhece esta alteração, redefina sua senha e revise os acessos à sua conta.';

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

test('aplica a matriz publicada de assunto, título e ação', () => {
  const expected = [
    ['signup', 'Marca de Teste: confirme seu e-mail', 'Confirme seu e-mail', '305805', undefined],
    ['email', 'Marca de Teste: seu código de acesso', 'Acesse sua conta', '305805', undefined],
    ['recovery', 'Marca de Teste: redefina sua senha', 'Redefina sua senha', undefined, 'Criar nova senha'],
    ['magiclink', 'Marca de Teste: seu link de acesso', 'Acesse sua conta', '305805', 'Entrar na conta'],
    ['invite', 'Marca de Teste: você recebeu um convite', 'Aceite seu convite', undefined, 'Aceitar convite'],
    ['reauthentication', 'Marca de Teste: confirme esta ação', 'Confirme sua identidade', '305805', undefined],
  ] as const;

  for (const [actionType, subject, title, token, actionLabel] of expected) {
    const [plan] = planAuthEmail(authEmailPayload(actionType), TEST_AUTH_EMAIL_CONFIG);
    assert.equal(plan.subject, subject);
    assert.equal(plan.title, title);
    assert.equal(plan.token, token);
    assert.equal(plan.actionLabel, actionLabel);
    assert.equal(plan.safetyNotice, ACTION_SAFETY_NOTICE);
    assert.equal(plan.recipientRole, 'primary');
  }
});

test('não expõe campos internos de cópia nos planos públicos', () => {
  const [plan] = planAuthEmail(authEmailPayload('signup'), TEST_AUTH_EMAIL_CONFIG);
  assert.equal(Object.hasOwn(plan, 'subjectSuffix'), false);
});

test('não cria clique para eventos somente com código', () => {
  for (const actionType of ['signup', 'email', 'reauthentication'] as const) {
    const [plan] = planAuthEmail(authEmailPayload(actionType), TEST_AUTH_EMAIL_CONFIG);
    assert.equal(plan.token, '305805');
    assert.equal(plan.actionUrl, undefined);
  }
});

test('constrói links verificados somente para ações com link', () => {
  for (const [actionType, actionLabel, token] of [
    ['recovery', 'Criar nova senha', undefined],
    ['magiclink', 'Entrar na conta', '305805'],
    ['invite', 'Aceitar convite', undefined],
  ] as const) {
    const [plan] = planAuthEmail(authEmailPayload(actionType), TEST_AUTH_EMAIL_CONFIG);
    assert.equal(
      plan.actionUrl,
      `https://projeto.supabase.co/auth/v1/verify?token_hash=hash-do-endereco-novo&type=${actionType}&redirect_to=kad%3A%2F%2Fauth%2Flogin`
    );
    assert.equal(plan.actionLabel, actionLabel);
    assert.equal(plan.token, token);
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
  assert.deepEqual(plans.map((plan) => plan.actionLabel), [
    'Confirmar alteração',
    'Confirmar alteração',
  ]);
  assert.deepEqual(plans.map((plan) => plan.token), ['305805', '905409']);
});

test('planeja a mudança simples com os dois formatos oficiais de token', () => {
  for (const [token, tokenNew, expectedToken] of [
    ['305805', '', '305805'],
    ['', '905409', '905409'],
  ] as const) {
    const [plan] = planAuthEmail(authEmailPayload('email_change', {
      email_data: { token, token_new: tokenNew, token_hash_new: '' },
    }), TEST_AUTH_EMAIL_CONFIG);
    assert.deepEqual(
      { to: plan.to, token: plan.token, tokenHash: plan.tokenHash, recipientRole: plan.recipientRole },
      {
        to: 'novo@exemplo.com',
        token: expectedToken,
        tokenHash: 'hash-do-endereco-novo',
        recipientRole: 'new_email',
      }
    );
    assert.equal(plan.actionLabel, 'Confirmar alteração');
  }
});

test('não adiciona token nem URL às notificações de segurança', () => {
  const expected = [
    ['password_changed_notification', 'Marca de Teste: sua senha foi alterada', 'Senha alterada'],
    ['email_changed_notification', 'Marca de Teste: seu e-mail foi alterado', 'E-mail alterado'],
    ['phone_changed_notification', 'Marca de Teste: seu telefone foi alterado', 'Telefone alterado'],
    ['identity_linked_notification', 'Marca de Teste: novo acesso vinculado', 'Identidade vinculada'],
    ['identity_unlinked_notification', 'Marca de Teste: acesso removido', 'Identidade removida'],
    ['mfa_factor_enrolled_notification', 'Marca de Teste: verificação em duas etapas ativada', 'Fator de segurança adicionado'],
    ['mfa_factor_unenrolled_notification', 'Marca de Teste: verificação em duas etapas alterada', 'Fator de segurança removido'],
  ] as const;
  for (const [actionType, subject, title] of expected) {
    const [plan] = planAuthEmail(authEmailPayload(actionType), TEST_AUTH_EMAIL_CONFIG);
    assert.deepEqual(
      {
        subject: plan.subject,
        title: plan.title,
        token: plan.token,
        tokenHash: plan.tokenHash,
        actionUrl: plan.actionUrl,
        actionLabel: plan.actionLabel,
        recipientRole: plan.recipientRole,
        safetyNotice: plan.safetyNotice,
      },
      {
        subject,
        title,
        token: undefined,
        tokenHash: undefined,
        actionUrl: undefined,
        actionLabel: undefined,
        recipientRole: 'primary',
        safetyNotice: SECURITY_SAFETY_NOTICE,
      }
    );
  }
});

test('recusa eventos quando faltam dados ativos obrigatórios', () => {
  const invalidPayloads = [
    authEmailPayload('signup', { email_data: { token: '' } }),
    authEmailPayload('recovery', { email_data: { token_hash: '' } }),
    authEmailPayload('email_change', { user: { new_email: undefined }, email_data: { token_hash_new: '' } }),
    authEmailPayload('email_change', { email_data: { token_new: '', token_hash_new: 'hash-do-endereco-atual' } }),
  ];
  for (const payload of invalidPayloads) {
    assert.throws(
      () => planAuthEmail(payload, TEST_AUTH_EMAIL_CONFIG),
      AuthEmailInputError
    );
  }
});

test('valida todo redirect não vazio antes de selecionar o ramo da ação', () => {
  for (const actionType of ['signup', 'password_changed_notification', 'recovery'] as const) {
    assert.throws(
      () => planAuthEmail(authEmailPayload(actionType, {
        email_data: { redirect_to: 'https://app.exemplo.com.evil/auth/login' },
      }), TEST_AUTH_EMAIL_CONFIG),
      AuthEmailInputError
    );
  }
  assert.throws(
    () => planAuthEmail(authEmailPayload('signup'), {
      ...TEST_AUTH_EMAIL_CONFIG,
      brandName: 'Marca\r\nBcc: atacante@exemplo.com',
    }),
    AuthEmailInputError
  );
});

test('codifica parâmetros da URL e usa apenas a origem configurada do Supabase', () => {
  assert.equal(
    buildAuthVerificationUrl({
      supabaseUrl: 'https://projeto.supabase.co',
      tokenHash: 'hash com espaço/?&',
      actionType: 'invite',
      redirectTo: 'kad://auth/login?next=/provas&source=email',
      allowedRedirectPrefixes: TEST_AUTH_EMAIL_CONFIG.allowedRedirectPrefixes,
    }),
    'https://projeto.supabase.co/auth/v1/verify?token_hash=hash+com+espa%C3%A7o%2F%3F%26&type=invite&redirect_to=kad%3A%2F%2Fauth%2Flogin%3Fnext%3D%2Fprovas%26source%3Demail'
  );
  const [plan] = planAuthEmail(authEmailPayload('invite', {
    email_data: { site_url: 'https://atacante.exemplo.com' },
  }), TEST_AUTH_EMAIL_CONFIG);
  assert.match(plan.actionUrl!, /^https:\/\/projeto\.supabase\.co\/auth\/v1\/verify\?/);
});

test('permite redirect vazio somente em eventos sem URL de ação', () => {
  const [notification] = planAuthEmail(authEmailPayload('password_changed_notification', {
    email_data: { redirect_to: '' },
  }), TEST_AUTH_EMAIL_CONFIG);
  assert.equal(notification.actionUrl, undefined);
  assert.throws(
    () => planAuthEmail(authEmailPayload('recovery', {
      email_data: { redirect_to: '' },
    }), TEST_AUTH_EMAIL_CONFIG),
    AuthEmailInputError
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

test('não transforma uma URL não confiável em link executável', () => {
  const [signupPlan] = planAuthEmail(authEmailPayload('signup'), TEST_AUTH_EMAIL_CONFIG);
  const rendered = renderAuthEmail({
    ...signupPlan,
    actionLabel: 'Continuar',
    actionUrl: 'javascript:alert(1)',
  }, TEST_AUTH_EMAIL_CONFIG.brandName);
  assert.doesNotMatch(rendered.html, /href="javascript:/i);
  assert.match(rendered.html, /javascript:alert\(1\)/);
  assert.match(rendered.text, /Continuar: javascript:alert\(1\)/);
});

test('mantém os elementos visíveis equivalentes em HTML e texto', () => {
  const [plan] = planAuthEmail(authEmailPayload('magiclink'), TEST_AUTH_EMAIL_CONFIG);
  const rendered = renderAuthEmail(plan, TEST_AUTH_EMAIL_CONFIG.brandName);
  for (const value of [
    TEST_AUTH_EMAIL_CONFIG.brandName,
    plan.title,
    plan.introduction,
    plan.token!,
    plan.actionLabel!,
    plan.safetyNotice,
  ]) {
    assert.match(rendered.html, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(rendered.text, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(
    rendered.html,
    /https:\/\/projeto\.supabase\.co\/auth\/v1\/verify\?token_hash=hash-do-endereco-novo&amp;type=magiclink&amp;redirect_to=kad%3A%2F%2Fauth%2Flogin/
  );
  assert.match(
    rendered.text,
    /https:\/\/projeto\.supabase\.co\/auth\/v1\/verify\?token_hash=hash-do-endereco-novo&type=magiclink&redirect_to=kad%3A%2F%2Fauth%2Flogin/
  );
  assert.match(rendered.html, /^<!doctype html>/i);
  assert.match(rendered.html, /<html lang="pt-BR">/);
  assert.match(rendered.html, /<table role="presentation"/);
  assert.match(rendered.html, /max-width:560px/);
  assert.match(rendered.html, /font-family:monospace/);
  assert.deepEqual(rendered.text.split('\n\n').filter(Boolean), [
    TEST_AUTH_EMAIL_CONFIG.brandName,
    plan.title,
    plan.introduction,
    plan.token,
    `${plan.actionLabel}: ${plan.actionUrl}`,
    plan.safetyNotice,
  ]);
});
