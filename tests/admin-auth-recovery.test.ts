import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const adminApp = source('../admin/src/app.tsx');
const adminAuthContext = source('../admin/src/context/auth-context.tsx');
const adminLogin = source('../admin/src/pages/login-page.tsx');
const adminRecovery = source('../admin/src/pages/recover-password-page.tsx');
const adminNewPassword = source('../admin/src/pages/new-password-page.tsx');
const adminSupabase = source('../admin/src/lib/supabase.ts');

test('o painel oferece recuperação de senha com retorno para sua própria origem', () => {
  assert.match(adminApp, /path="\/recuperar-senha"/);
  assert.match(adminApp, /path="\/auth\/nova-senha"/);
  assert.match(adminLogin, /to="\/recuperar-senha"/);
  assert.match(adminRecovery, /new URL\('\/auth\/nova-senha', window\.location\.origin\)/);
  assert.match(adminRecovery, /resetPasswordForEmail\(email\.trim\(\),/);
});

test('a nova senha exige sessão de recuperação e encerra a sessão após a troca', () => {
  assert.match(adminSupabase, /detectSessionInUrl: true/);
  assert.match(adminNewPassword, /!supabase \|\| !session/);
  assert.match(adminNewPassword, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(adminNewPassword, /await signOut\(\)/);
  assert.match(adminAuthContext, /auth\.signOut\(\{ scope: 'local' \}\)/);
});
