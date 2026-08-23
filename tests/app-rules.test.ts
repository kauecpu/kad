import assert from 'node:assert/strict';
import test from 'node:test';

import { CONCURSOS } from '../data/concursos.ts';
import { DISCIPLINES } from '../data/disciplines.ts';
import { CONCURSO_PACKS } from '../data/exam-concursos.ts';
import { QUESTIONS } from '../data/questions.ts';
import {
  BASIC_PLAN_ACCESS,
  DIAMOND_BENEFITS,
  PLATINUM_BENEFITS,
  PLATINUM_BILLING_OPTIONS,
} from '../data/user.ts';
import {
  currentDailyUsage,
  recordDailyQuestionUsage,
  subscriptionHasAccess,
  subscriptionWithCurrentStatus,
} from '../lib/access-rules.ts';
import { authErrorMessage } from '../lib/auth-errors.ts';
import { authRouteAccess } from '../lib/auth-routing.ts';
import {
  EMAIL_OTP_LENGTH,
  authCallbackKindFromUrl,
  authCodeFromUrl,
  isAuthCallbackUrl,
  isValidEmailOtp,
  normalizeEmailOtp,
} from '../lib/auth-security.ts';
import {
  findStudyPackForConcurso,
  matchesSalaryRanges,
  recommendConcursosForGoal,
  searchConcursos,
  sortConcursos,
} from '../lib/concursos.ts';
import { formatSalaryShort } from '../lib/format.ts';
import {
  isTrustedPaymentCheckoutUrl,
  isValidPaymentCheckoutReturnId,
} from '../lib/payment-security.ts';
import {
  formatBrazilianPhone,
  isValidUsername,
  normalizeUsername,
  sanitizeLegacyGuestProfile,
} from '../lib/profile.ts';
import { EMPTY_SEARCH, searchQuestions, topicsForDisciplines } from '../lib/search.ts';
import {
  INITIAL_SELECTION_SHEET_SEARCH,
  selectionSheetSearchReducer,
} from '../lib/selection-sheet.ts';
import {
  questionsForPack,
  recommendPackForGoal,
  simulationCandidates,
} from '../lib/simulations.ts';
import {
  subscriptionAfterCancellation,
  subscriptionFromRemote,
  subscriptionHasVerifiedAccess,
  subscriptionIsLoading,
} from '../lib/subscription-state.ts';
import type { DailyQuestionUsage, Subscription } from '../types/index.ts';

test('a pesquisa do seletor não passa de Banca para Estado', () => {
  let state = selectionSheetSearchReducer(INITIAL_SELECTION_SHEET_SEARCH, {
    type: 'sync',
    context: 'Banca',
    visible: true,
  });
  state = selectionSheetSearchReducer(state, { type: 'query', query: 'VUNESP' });
  state = selectionSheetSearchReducer(state, {
    type: 'sync',
    context: 'Estado',
    visible: true,
  });

  assert.equal(state.query, '');
  assert.equal(state.context, 'Estado');
});

test('fechar o seletor limpa a pesquisa atual', () => {
  const searching = {
    context: 'Banca',
    query: 'VUNESP',
    visible: true,
  };
  const closed = selectionSheetSearchReducer(searching, { type: 'close' });
  assert.equal(closed.query, '');
  assert.equal(closed.visible, false);
});

test('a atividade diária é renovada quando muda a data local', () => {
  const previous: DailyQuestionUsage = {
    date: '2026-07-29',
    questionIds: ['q-1', 'q-2'],
  };
  assert.deepEqual(currentDailyUsage(previous, new Date(2026, 6, 30, 1)), {
    date: '2026-07-30',
    questionIds: [],
  });
});

test('a atividade diária registra novas questões sem aplicar cota', () => {
  const usage: DailyQuestionUsage = {
    date: '2026-07-30',
    questionIds: Array.from({ length: 25 }, (_, index) => `q-${index + 1}`),
  };
  const updated = recordDailyQuestionUsage(usage, 'q-26', new Date(2026, 6, 30, 12));

  assert.equal(updated.questionIds.length, 26);
  assert.equal(updated.questionIds.at(-1), 'q-26');
});

test('a assinatura expira sem precisar recarregar o estado salvo', () => {
  const subscription: Subscription = {
    plan: 'diamond',
    billingCycle: 'monthly',
    status: 'active',
    renewsAt: '2026-07-30',
    autoRenew: true,
  };

  assert.equal(
    subscriptionWithCurrentStatus(subscription, new Date(2026, 6, 30, 23, 59)).status,
    'active'
  );
  assert.equal(
    subscriptionWithCurrentStatus(subscription, new Date(2026, 6, 31, 0, 0)).status,
    'expired'
  );
});

test('o acesso pago exige período válido confirmado pelo servidor', () => {
  const base: Subscription = {
    plan: 'diamond',
    billingCycle: 'monthly',
    provider: 'mercado_pago',
    status: 'active',
    startedAt: '2026-08-01T12:00:00.000Z',
    renewsAt: '2026-09-01T12:00:00.000Z',
    autoRenew: true,
  };
  const duringPeriod = new Date('2026-08-15T12:00:00.000Z');

  assert.equal(subscriptionHasAccess(base, duringPeriod), true);
  assert.equal(subscriptionHasAccess({ ...base, status: 'past_due' }, duringPeriod), true);
  assert.equal(subscriptionHasAccess({ ...base, status: 'canceled' }, duringPeriod), true);
  assert.equal(subscriptionHasAccess({ ...base, renewsAt: 'inválida' }, duringPeriod), false);
  assert.equal(
    subscriptionHasAccess(base, new Date('2026-09-01T12:00:00.000Z')),
    false
  );
});

test('o estado remoto inválido nunca libera uma assinatura', () => {
  const valid = subscriptionFromRemote(
    {
      plan: 'diamond',
      billing_cycle: 'annual',
      provider: 'mercado_pago',
      provider_status: 'authorized',
      status: 'active',
      started_at: '2026-08-01T12:00:00.000Z',
      current_period_end: '2027-08-01T12:00:00.000Z',
      cancel_at_period_end: false,
    },
    new Date('2026-08-11T12:00:00.000Z')
  );
  const invalid = subscriptionFromRemote(
    {
      plan: 'diamond',
      billing_cycle: 'annual',
      provider: 'desconhecido',
      provider_status: 'authorized',
      status: 'active',
      started_at: '2026-08-01T12:00:00.000Z',
      current_period_end: '2027-08-01T12:00:00.000Z',
      cancel_at_period_end: false,
    },
    new Date('2026-08-11T12:00:00.000Z')
  );

  assert.equal(valid.plan, 'diamond');
  assert.equal(valid.autoRenew, true);
  assert.equal(invalid.plan, 'basic');
  assert.equal(subscriptionHasAccess(invalid), false);
});

test('assinatura permanece carregando até consultar o usuário autenticado atual', () => {
  const base = {
    authLoading: false,
    userId: 'user-1',
    checkedUserId: null,
    refreshing: false,
  };

  assert.equal(subscriptionIsLoading({ ...base, hydrated: false }), true);
  assert.equal(subscriptionIsLoading({ ...base, hydrated: true }), true);
  assert.equal(
    subscriptionIsLoading({
      authLoading: true,
      userId: null,
      hydrated: false,
      checkedUserId: null,
      refreshing: false,
    }),
    true
  );
  assert.equal(
    subscriptionIsLoading({ ...base, hydrated: true, checkedUserId: 'user-1' }),
    false
  );
  assert.equal(
    subscriptionIsLoading({
      ...base,
      hydrated: true,
      checkedUserId: 'user-1',
      refreshing: true,
    }),
    true
  );
});

test('troca de usuário e logout não reaproveitam acesso Premium antigo', () => {
  const premium: Subscription = {
    plan: 'diamond',
    billingCycle: 'monthly',
    provider: 'mercado_pago',
    status: 'active',
    startedAt: '2026-08-01T12:00:00.000Z',
    renewsAt: '2026-09-01T12:00:00.000Z',
    autoRenew: true,
  };
  const loadingAfterUserChange = subscriptionIsLoading({
    authLoading: false,
    userId: 'user-2',
    hydrated: true,
    checkedUserId: 'user-1',
    refreshing: false,
  });

  assert.equal(
    subscriptionHasVerifiedAccess({ userId: 'user-1', loading: false, subscription: premium }),
    true
  );
  assert.equal(
    subscriptionHasVerifiedAccess({
      userId: 'user-2',
      loading: loadingAfterUserChange,
      subscription: premium,
    }),
    false
  );
  assert.equal(
    subscriptionHasVerifiedAccess({ userId: null, loading: false, subscription: premium }),
    false
  );
});

test('cancelamento confirmado permanece refletido se a atualização posterior falhar', () => {
  const current = subscriptionFromRemote(
    {
      plan: 'diamond',
      billing_cycle: 'monthly',
      provider: 'mercado_pago',
      provider_status: 'paused',
      status: 'past_due',
      started_at: '2026-08-01T12:00:00.000Z',
      current_period_end: '2026-09-01T12:00:00.000Z',
      cancel_at_period_end: false,
    },
    new Date('2026-08-15T12:00:00.000Z')
  );

  assert.equal(current.autoRenew, true);
  assert.deepEqual(subscriptionAfterCancellation(current), { ...current, autoRenew: false });
});

test('o app só aceita checkout HTTPS em domínio oficial do Mercado Pago', () => {
  assert.equal(
    isTrustedPaymentCheckoutUrl('https://www.mercadopago.com.br/subscriptions/checkout'),
    true
  );
  assert.equal(
    isTrustedPaymentCheckoutUrl('https://checkout.mercadopago.com/subscriptions'),
    true
  );
  assert.equal(
    isTrustedPaymentCheckoutUrl('https://mercadopago.com.br.exemplo.com/roubo'),
    false
  );
  assert.equal(isTrustedPaymentCheckoutUrl('http://mercadopago.com.br/inseguro'), false);
});

test('retorno do checkout exige um UUID válido antes de consultar a assinatura', () => {
  assert.equal(isValidPaymentCheckoutReturnId('94371c2e-c0f3-4580-b7e5-f481614d0763'), true);
  assert.equal(isValidPaymentCheckoutReturnId('true'), false);
  assert.equal(isValidPaymentCheckoutReturnId('../assinatura-de-outra-pessoa'), false);
  assert.equal(isValidPaymentCheckoutReturnId(['94371c2e-c0f3-4580-b7e5-f481614d0763']), false);
});

test('todos os concursos apontam para uma página oficial HTTPS', () => {
  assert.equal(CONCURSOS.length, 15);
  for (const concurso of CONCURSOS) {
    assert.match(concurso.editalUrl, /^https:\/\//);
  }
});

test('o banco de questões é equilibrado e internamente consistente', () => {
  assert.ok(QUESTIONS.length >= 50);
  assert.equal(new Set(QUESTIONS.map((question) => question.id)).size, QUESTIONS.length);

  const disciplineMap = new Map(DISCIPLINES.map((discipline) => [discipline.name, discipline]));
  const counts = new Map<string, number>();

  for (const question of QUESTIONS) {
    const discipline = disciplineMap.get(question.discipline);
    assert.ok(discipline, `Disciplina inexistente em ${question.id}`);
    assert.ok(discipline.topics.includes(question.topic), `Assunto inválido em ${question.id}`);
    assert.ok(
      question.alternatives.some((alternative) => alternative.id === question.correct),
      `Gabarito inexistente em ${question.id}`
    );
    counts.set(question.discipline, (counts.get(question.discipline) ?? 0) + 1);
  }

  for (const discipline of DISCIPLINES) {
    assert.ok(
      (counts.get(discipline.name) ?? 0) >= 4,
      `${discipline.name} precisa ter ao menos quatro questões`
    );
  }
});

test('as buscas encontram termos digitados sem acento', () => {
  assert.ok(searchConcursos(CONCURSOS, 'tecnico').length > 0);

  const results = searchQuestions({ ...EMPTY_SEARCH, keyword: 'matematica' }, {});
  assert.ok(results.length > 0);
  assert.ok(results.some((question) => question.discipline === 'Matemática'));
});

test('os assuntos disponíveis acompanham as disciplinas selecionadas', () => {
  const mathTopics = topicsForDisciplines(['Matemática']);
  assert.ok(mathTopics.length > 0);
  assert.ok(
    mathTopics.every((topic) =>
      QUESTIONS.some(
        (question) => question.discipline === 'Matemática' && question.topic === topic
      )
    )
  );
  assert.ok(
    QUESTIONS.some(
      (question) =>
        question.discipline !== 'Matemática' && !mathTopics.includes(question.topic)
    )
  );
});

test('concursos podem ser ordenados por salário, vagas e atualização', () => {
  const bySalary = sortConcursos(CONCURSOS, 'salary');
  const byVacancies = sortConcursos(CONCURSOS, 'vacancies');
  const byUpdated = sortConcursos(CONCURSOS, 'updated');

  assert.ok(bySalary[0].salaryMax >= bySalary.at(-1)!.salaryMax);
  assert.ok(byVacancies[0].vacancies >= byVacancies.at(-1)!.vacancies);
  assert.ok(new Date(byUpdated[0].updatedAt) >= new Date(byUpdated.at(-1)!.updatedAt));
  assert.notEqual(bySalary, CONCURSOS);
});

test('o filtro de faixa salarial usa o maior salário anunciado', () => {
  const lowSalary = CONCURSOS.find((concurso) => concurso.salaryMax <= 3000);
  const highSalary = CONCURSOS.find((concurso) => concurso.salaryMax > 10000);
  assert.ok(lowSalary);
  assert.ok(highSalary);
  assert.equal(matchesSalaryRanges(lowSalary, ['until-3000']), true);
  assert.equal(matchesSalaryRanges(highSalary, ['until-3000']), false);
  assert.equal(matchesSalaryRanges(highSalary, ['above-10000']), true);
});

test('a máscara de telefone é aplicada progressivamente e limita onze dígitos', () => {
  assert.equal(formatBrazilianPhone('11988771234'), '(11) 98877-1234');
  assert.equal(formatBrazilianPhone('(11) 98877-123456'), '(11) 98877-1234');
  assert.equal(formatBrazilianPhone('1134567890'), '(11) 3456-7890');
});

test('o perfil fictício antigo não aparece para o visitante', () => {
  assert.deepEqual(
    sanitizeLegacyGuestProfile({
      name: 'Ana Beatriz Moreira',
      email: 'ana.moreira@email.com',
      phone: '(11) 98877-1234',
      city: 'São Paulo, SP',
      targetRole: 'Analista Judiciário',
    }),
    {
      name: 'Visitante',
      email: '',
      phone: undefined,
      city: undefined,
      targetRole: undefined,
    }
  );
});

test('o identificador de usuário é normalizado e validado', () => {
  assert.equal(normalizeUsername(' João.Silva 2026 '), 'joaosilva2026');
  assert.equal(normalizeUsername('KAD_usuario'), 'kad_usuario');
  assert.equal(isValidUsername('kad_usuario'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('usuario-com-hifen'), false);
});

test('callbacks de autenticação aceitam somente rotas previstas e códigos PKCE', () => {
  assert.equal(authCallbackKindFromUrl('kad://auth/login?code=abc'), 'confirmation');
  assert.equal(authCallbackKindFromUrl('kad:///auth/nova-senha?code=abc'), 'recovery');
  assert.equal(
    authCallbackKindFromUrl('https://app.kad.com.br/auth/nova-senha?code=abc'),
    'recovery'
  );
  assert.equal(authCallbackKindFromUrl('kad://perfil?code=abc'), null);
  assert.deepEqual(authCodeFromUrl('kad://auth/login?code=abc'), {
    callback: 'confirmation',
    code: 'abc',
    errorDescription: undefined,
  });
  assert.equal(
    authCodeFromUrl('kad://auth/login#access_token=exposto&refresh_token=exposto').code,
    undefined
  );
  assert.equal(isAuthCallbackUrl('https://app.kad.com.br/auth/login'), false);
  assert.equal(isAuthCallbackUrl('https://app.kad.com.br/auth/login?code=abc'), true);
  assert.equal(
    isAuthCallbackUrl('https://app.kad.com.br/auth/login?error=access_denied'),
    true
  );
});

test('erros de autenticação não expõem detalhes internos ao usuário', () => {
  assert.equal(
    authErrorMessage({ code: 'email_not_confirmed' }),
    'Confirme seu e-mail antes de entrar.'
  );
  assert.equal(
    authErrorMessage({ code: 'over_request_rate_limit' }),
    'Muitas tentativas. Aguarde um momento e tente novamente.'
  );
  assert.equal(
    authErrorMessage({ code: 'request_timeout' }),
    'A conexão demorou demais. Verifique sua internet e tente novamente.'
  );
  assert.equal(
    authErrorMessage({ message: 'sensitive provider failure details' }),
    'Não foi possível concluir a operação. Tente novamente.'
  );
});

test('códigos de confirmação por e-mail aceitam somente seis números', () => {
  assert.equal(EMAIL_OTP_LENGTH, 6);
  assert.equal(normalizeEmailOtp('12 34-56abc78-9'), '123456');
  assert.equal(isValidEmailOtp('123456'), true);
  assert.equal(isValidEmailOtp('12345'), false);
  assert.equal(isValidEmailOtp('1234567'), false);
  assert.equal(isValidEmailOtp('abcdef'), false);
  assert.equal(
    authErrorMessage({ code: 'otp_expired' }),
    'Código inválido ou expirado. Solicite um novo código.'
  );
});

test('as rotas de sessão separam visitante, conta autenticada e acesso público', () => {
  assert.deepEqual(
    authRouteAccess({ hasSession: false, isGuest: false, isLoading: true }),
    {
      welcome: false,
      auth: true,
      app: true,
    }
  );
  assert.deepEqual(authRouteAccess({ hasSession: false, isGuest: false }), {
    welcome: true,
    auth: true,
    app: false,
  });
  assert.deepEqual(authRouteAccess({ hasSession: false, isGuest: true }), {
    welcome: false,
    auth: true,
    app: true,
  });
  assert.deepEqual(authRouteAccess({ hasSession: true, isGuest: false }), {
    welcome: false,
    auth: false,
    app: true,
  });
});

test('o KAD Platina preserva os três ciclos com desconto progressivo', () => {
  const monthly = PLATINUM_BILLING_OPTIONS.find((option) => option.id === 'monthly');
  const platinumQuarterly = PLATINUM_BILLING_OPTIONS.find(
    (option) => option.id === 'quarterly'
  );
  const annual = PLATINUM_BILLING_OPTIONS.find((option) => option.id === 'annual');

  assert.deepEqual(
    { price: monthly?.price, durationDays: monthly?.durationDays },
    { price: 14.99, durationDays: 30 }
  );
  assert.deepEqual(
    { price: platinumQuarterly?.price, durationDays: platinumQuarterly?.durationDays },
    { price: 39.99, durationDays: 90 }
  );
  assert.deepEqual(
    { price: annual?.price, durationDays: annual?.durationDays },
    { price: 149.99, durationDays: 365 }
  );
});

test('o Plano Básico comunica somente prática ilimitada e correção', () => {
  assert.deepEqual(
    BASIC_PLAN_ACCESS.map((feature) => feature.label),
    ['Questões ilimitadas', 'Correção e gabarito comentado']
  );
  assert.ok(BASIC_PLAN_ACCESS.every((feature) => feature.included));
});

test('KAD Platina e KAD Diamante compartilham temporariamente os mesmos benefícios', () => {
  assert.deepEqual(DIAMOND_BENEFITS, PLATINUM_BENEFITS);
  assert.ok(PLATINUM_BENEFITS.length >= 6);
  assert.ok(PLATINUM_BENEFITS.some((benefit) => benefit.includes('Simulados personalizados')));
  assert.ok(PLATINUM_BENEFITS.some((benefit) => benefit.includes('Desempenho geral')));
  assert.ok(PLATINUM_BENEFITS.some((benefit) => benefit.includes('questões erradas')));
});

test('concursos compatíveis com a meta do perfil são recomendados', () => {
  const recommended = recommendConcursosForGoal(CONCURSOS, 'Analista Judiciário');
  assert.ok(recommended.length > 0);
  assert.ok(
    recommended.some((concurso) =>
      concurso.roles.some((role) => role.name.includes('Analista Judiciário'))
    )
  );
});

test('editais usam somente pacotes de estudo já existentes', () => {
  const bancoDoBrasil = CONCURSOS.find((concurso) => concurso.organ === 'Banco do Brasil');
  assert.ok(bancoDoBrasil);
  assert.equal(findStudyPackForConcurso(bancoDoBrasil, CONCURSO_PACKS)?.id, 'banco-do-brasil');
});

test('salários compactos não exibem precisão desnecessária', () => {
  assert.equal(formatSalaryShort(2100), 'R$ 2,1 mil');
  assert.equal(formatSalaryShort(14000), 'R$ 14 mil');
});

test('cada pacote de simulado possui questões dentro do seu escopo real', () => {
  for (const pack of CONCURSO_PACKS) {
    const questions = questionsForPack(pack);
    assert.ok(questions.length > 0, pack.name);

    const candidates = simulationCandidates({
      packId: pack.id,
      disciplines: [],
      topics: [],
      boards: [],
      years: [],
      difficulties: [],
      questionCount: 30,
      durationMinutes: 30,
      shuffleQuestions: false,
      shuffleAlternatives: false,
    });
    assert.deepEqual(candidates.map((item) => item.id), questions.map((item) => item.id));
  }
});

test('simulado do Banco do Brasil não mistura questões de outros órgãos', () => {
  const pack = CONCURSO_PACKS.find((item) => item.id === 'banco-do-brasil');
  assert.ok(pack);
  const questions = questionsForPack(pack);
  assert.ok(questions.length > 0);
  assert.ok(questions.every((question) => question.institution === 'Banco do Brasil'));
});

test('meta de Analista Judiciário recomenda a área de Tribunais', () => {
  assert.equal(recommendPackForGoal(CONCURSO_PACKS, 'Analista Judiciário')?.id, 'tribunais');
});
