import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const provider = source('../providers/app-provider.tsx');
const plans = source('../app/perfil/planos.tsx');
const player = source('../app/questoes/simulado/index.tsx');
const result = source('../app/questoes/simulado/resultado.tsx');
const configure = source('../app/questoes/simulado/configurar.tsx');
const simulationsTab = source('../app/(tabs)/simulados.tsx');
const home = source('../app/(tabs)/inicio.tsx');
const questionsTab = source('../app/(tabs)/questoes.tsx');
const questionCard = source('../components/question-card.tsx');

test('rotas diretas do simulado aguardam a verificação e bloqueiam plano sem acesso', () => {
  for (const screen of [player, result]) {
    assert.match(screen, /!subscriptionLoading && !canUseSimulations/);
    assert.match(screen, /subscriptionLoading \|\| !canUseSimulations/);
    assert.match(screen, /router\.replace\('\/perfil\/planos'\)/);
  }
});

test('criação e continuação ficam inativas enquanto a assinatura está carregando', () => {
  assert.match(configure, /if \(subscriptionLoading\) return/);
  assert.match(configure, /disabled=\{subscriptionLoading \|\| candidates\.length === 0\}/);
  assert.match(
    simulationsTab,
    /\{session \? \([\s\S]*?<Pressable[\s\S]*?disabled=\{subscriptionLoading\}[\s\S]*?canUseSimulations[\s\S]*?router\.push/
  );
});

test('sessão antiga não cria atalho Premium na tela inicial', () => {
  assert.match(home, /simulation: isPremium && session/);
  assert.match(provider, /subscriptionHasVerifiedAccess/);
  assert.match(
    provider,
    /setSubscriptionCheckedUserId\(null\)[\s\S]*?subscription: DEFAULT_SUBSCRIPTION/
  );
});

test('retorno do checkout apenas dispara consulta após validar o UUID', () => {
  assert.match(plans, /isValidPaymentCheckoutReturnId\(checkout\)/);
  assert.match(plans, /await refreshSubscription\(\)/);
  assert.doesNotMatch(plans, /if \(!checkout \|\| !session\)/);
});

test('cancelamento confirmado não é revertido por falha de atualização', () => {
  assert.match(
    provider,
    /subscriptionAfterCancellation\(current\.subscription\)[\s\S]*?refreshSubscription\(\)\.catch/
  );
});

test('o KAD Círculo não é oferecido para novas assinaturas', () => {
  assert.doesNotMatch(plans, /title="KAD Círculo"/);
  assert.doesNotMatch(plans, /subscribeTo\('circle'/);
});

test('o Plano Básico permite responder questões sem limite diário', () => {
  assert.doesNotMatch(provider, /BASIC_DAILY_QUESTION_LIMIT|canAnswerWithDailyLimit/);
  assert.doesNotMatch(questionCard, /Limite diário atingido|onLimitReached|canAnswer/);
  assert.match(questionsTab, /Plano Básico · questões ilimitadas/);
  assert.match(plans, /Questões ilimitadas, sem cobrança e sem prazo/);
});
