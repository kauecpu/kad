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
const signupScreen = source('../app/auth/cadastro.tsx');
const confirmationScreen = source('../app/auth/confirmar-email.tsx');
const onboardingScreen = source('../app/onboarding.tsx');
const profileScreen = source('../app/(tabs)/perfil.tsx');
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

test('a marca da tela inicial mantém contraste no tema escuro', () => {
  assert.match(welcomeScreen, /const \{ colors, isDark \} = useTheme\(\)/);
  assert.match(welcomeScreen, /isDark \? \(/);
  assert.match(welcomeScreen, /styles\.darkWordmark/);
  assert.match(welcomeScreen, /tintColor: colors\.text/);
  assert.match(welcomeScreen, /accessibilityLabel="KAD Concursos"/);
});

test('sair da conta revoga apenas a sessão deste aparelho', () => {
  assert.match(authProvider, /auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.doesNotMatch(authProvider, /auth\.signOut\(\);/);
});

test('sair da conta usa uma confirmação compatível com a web', () => {
  assert.match(profileScreen, /Platform\.OS === 'web'/);
  assert.match(profileScreen, /globalThis\.confirm/);
  assert.match(profileScreen, /void performSignOut\(\)/);
});

test('cadastro solicita nome, e-mail, senha e confirmação da senha', () => {
  assert.match(signupScreen, /label="Nome completo"/);
  assert.match(signupScreen, /label="E-mail"/);
  assert.match(signupScreen, /label="Senha"/);
  assert.doesNotMatch(signupScreen, /label="Usuário"/);
  assert.match(signupScreen, /label="Repetir senha"/);
  assert.match(signupScreen, /password !== passwordConfirmation/);
  assert.match(signupScreen, /signUp\(name\.trim\(\), email\.trim\(\), password\)/);
  assert.match(authProvider, /data: \{ name \}/);
  assert.doesNotMatch(authProvider, /supabase\.rpc\(\s*'is_username_available'/);
});

test('confirmação de e-mail orienta contas que já existem sem expô-las', () => {
  assert.match(confirmationScreen, /Se este e-mail for novo/);
  assert.match(confirmationScreen, /Este e-mail pode já estar cadastrado/);
  assert.match(confirmationScreen, /router\.replace\('\/auth\/login'\)/);
  assert.match(confirmationScreen, /router\.push\('\/auth\/recuperar-senha'\)/);
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
