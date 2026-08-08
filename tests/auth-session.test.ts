import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const rootLayout = source('../app/_layout.tsx');
const welcomeScreen = source('../app/index.tsx');
const loginScreen = source('../app/auth/login.tsx');
const confirmationScreen = source('../app/auth/confirmar-email.tsx');
const onboardingScreen = source('../app/onboarding.tsx');
const onboardingStorage = source('../lib/onboarding.ts');
const authProvider = source('../providers/auth-provider.tsx');

test('a tela de nova senha permanece montada quando a recuperacao cria a sessao', () => {
  assert.match(rootLayout, /<Stack\.Screen name="auth\/nova-senha"/);
  assert.doesNotMatch(rootLayout, /routeAccess\.passwordRecovery/);
  assert.doesNotMatch(rootLayout, /if \(isLoading \|\| !hydrated\)/);
  assert.match(rootLayout, /StyleSheet\.absoluteFill/);
  assert.match(loginScreen, /!authLinkChecking &&/);
  assert.match(loginScreen, /!recoveryReady &&/);
  assert.match(loginScreen, /pathname === '\/auth\/login'/);
  assert.match(
    confirmationScreen,
    /pathname === '\/auth\/confirmar-email'/
  );
});

test('a rota raiz permanece como âncora e redireciona sessões para o início', () => {
  assert.match(rootLayout, /<Stack\.Screen name="index"/);
  assert.doesNotMatch(rootLayout, /guard=\{routeAccess\.welcome\}/);
  assert.match(welcomeScreen, /canAccessApp &&/);
  assert.match(welcomeScreen, /!authLinkChecking &&/);
  assert.match(welcomeScreen, /!recoveryReady &&/);
  assert.match(welcomeScreen, /pathname === '\/'/);
});

test('sair da conta revoga apenas a sessão deste aparelho', () => {
  assert.match(authProvider, /auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.doesNotMatch(authProvider, /auth\.signOut\(\);/);
});

test('o e-mail de confirmação fica somente em memória e o valor legado é removido', () => {
  assert.match(authProvider, /LEGACY_PENDING_VERIFICATION_EMAIL_STORAGE_KEY/);
  assert.match(
    authProvider,
    /AsyncStorage\.removeItem\(LEGACY_PENDING_VERIFICATION_EMAIL_STORAGE_KEY\)/
  );
  assert.doesNotMatch(
    authProvider,
    /AsyncStorage\.setItem\(LEGACY_PENDING_VERIFICATION_EMAIL_STORAGE_KEY/
  );
});

test('o primeiro login apresenta o KAD uma vez antes de abrir o inicio', () => {
  assert.match(rootLayout, /<Stack\.Screen name="onboarding"/);
  assert.match(welcomeScreen, /getPostAuthRoute\(session\.user\.id\)/);
  assert.match(loginScreen, /getPostAuthRoute\(session\.user\.id\)/);
  assert.match(confirmationScreen, /getPostAuthRoute\(session\.user\.id\)/);
  assert.match(onboardingScreen, /horizontal/);
  assert.match(onboardingScreen, /pagingEnabled/);
  assert.match(onboardingScreen, /markOnboardingComplete\(session\.user\.id\)/);
  assert.match(onboardingStorage, /ONBOARDING_STORAGE_PREFIX/);
});
