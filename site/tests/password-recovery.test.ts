import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPasswordSecurity } from '../src/core/password-security.ts';
import { parseRecoveryCallback, recoveryCallbackFailure } from '../src/core/auth-callback.ts';
import { createRecoveryRequest, recoveryFailure, recoveryMessage } from '../src/core/password-recovery.ts';
import { recoveryView } from '../src/views/public.ts';

const callback = { code: 'fixture-code', flowId: 'fixture-flow-123' };

function authFixture() {
  const calls: string[] = [];
  return {
    calls,
    exchangeCodeForSession: async () => ({
      data: { session: { user: { id: 'fixture-user' } }, redirectType: 'recovery' }, error: null as unknown,
    }),
    getUser: async () => ({ data: { user: { id: 'fixture-user' } }, error: null }),
    updateUser: async () => { calls.push('update'); return { error: null }; },
    signOut: async ({ scope }: { scope: 'others' | 'local' }) => { calls.push(scope); return { error: null }; },
  };
}

test('callback rejeita parâmetros PKCE duplicados', () => {
  assert.equal(parseRecoveryCallback('https://kad.example/nova-senha?code=a&code=b&sb_flow_id=fixture-flow-123', 'https://kad.example'), null);
});

test('erros do provedor são classificados sem inventar expiração ou reutilização', () => {
  for (const [code, reason] of [
    ['flow_state_expired', 'expired'], ['otp_expired', 'expired-or-used'],
    ['flow_state_not_found', 'expired-or-used'], ['bad_code_verifier', 'session-mismatch'],
    ['session_not_found', 'session-missing'], ['over_email_send_rate_limit', 'rate-limit'],
    ['weak_password', 'weak-password'], ['same_password', 'same-password'], ['unexpected_failure', 'technical'],
  ]) assert.equal(recoveryFailure({ code }), reason);
  assert.equal(recoveryFailure({ name: 'AuthRetryableFetchError' }), 'network');
  assert.equal(recoveryFailure({ status: 429 }), 'rate-limit');
});

test('callback de erro lê somente código conhecido e nunca a descrição remota', () => {
  const origin = 'https://kad.example';
  const url = `${origin}/nova-senha#error=access_denied&error_code=otp_expired&error_description=<script>private</script>`;
  assert.equal(parseRecoveryCallback(url, origin), null);
  assert.equal(recoveryCallbackFailure(url, origin), 'expired-or-used');
  assert.equal(recoveryCallbackFailure(`${origin}/nova-senha?error_code=flow_state_expired`, origin), 'expired');
  assert.equal(recoveryCallbackFailure('https://evil.example/nova-senha?error_code=otp_expired', origin), 'invalid-link');
  assert.equal(recoveryCallbackFailure(`${origin}/nova-senha?code=x`, origin), 'session-missing');
  assert.equal(recoveryCallbackFailure(`${origin}/nova-senha`, origin), 'interrupted');
  assert.equal(recoveryCallbackFailure('not a URL', origin), 'invalid-link');
});

test('callback rejeita fragmentos, tokens, erros misturados e flow ID repetido', () => {
  const base = 'https://kad.example/nova-senha?code=fixture&sb_flow_id=fixture-flow-123';
  for (const suffix of ['#access_token=fixture', '&access_token=fixture', '&refresh_token=fixture', '&error=denied', '&error_code=otp_expired', '&sb_flow_id=fixture-flow-456']) {
    assert.equal(parseRecoveryCallback(base + suffix, 'https://kad.example'), null);
  }
});

test('recuperação válida troca senha uma vez, encerra sessões e não aceita reutilização', async () => {
  const auth = authFixture();
  const security = createPasswordSecurity(auth);
  assert.equal((await security.completeRecovery(callback)).ok, true);
  assert.deepEqual(await security.updateRecovered('fixture-password'), { ok: true });
  assert.deepEqual(auth.calls, ['update', 'others', 'local']);
  assert.deepEqual(await security.updateRecovered('fixture-password'), { ok: false, reason: 'recovery-not-validated' });
});

test('recarregar não transforma uma sessão comum em autorização de recuperação', async () => {
  const auth = authFixture();
  await createPasswordSecurity(auth).completeRecovery(callback);
  const reloaded = createPasswordSecurity(auth);
  assert.deepEqual(await reloaded.updateRecovered('fixture-password'), { ok: false, reason: 'recovery-not-validated' });
  assert.deepEqual(auth.calls, []);
  assert.match(recoveryView('new-password', { recoveryStatus: 'invalid', recoveryError: 'interrupted' }).content, /atualizou ou fechou/);
});

test('falha de atualização mantém possibilidade de tentar novamente sem declarar sucesso', async () => {
  const auth = authFixture();
  let fails = true;
  auth.updateUser = async () => {
    if (fails) throw new TypeError('Failed to fetch');
    auth.calls.push('update');
    return { error: null };
  };
  const security = createPasswordSecurity(auth);
  await security.completeRecovery(callback);
  assert.deepEqual(await security.updateRecovered('fixture-password'), { ok: false, reason: 'network' });
  fails = false;
  assert.equal((await security.updateRecovered('fixture-password')).ok, true);
});

test('falha de logout após alteração não diz que a senha deixou de mudar', async () => {
  const auth = authFixture();
  auth.signOut = async ({ scope }) => { auth.calls.push(scope); throw new Error('fixture outage'); };
  const security = createPasswordSecurity(auth);
  await security.completeRecovery(callback);
  assert.deepEqual(await security.updateRecovered('fixture-password'), { ok: true, warning: 'logout-failed' });
  assert.deepEqual(auth.calls, ['update', 'others', 'local']);
  assert.equal((await security.updateRecovered('fixture-password')).ok, false);
});

test('envios concorrentes e clique repetido não consomem dois e-mails', async () => {
  let sends = 0;
  let time = 1;
  let resolve!: (result: { error: unknown }) => void;
  const send = createRecoveryRequest(async () => {
    sends++;
    return new Promise<{ error: unknown }>(done => { resolve = done; });
  }, () => time);
  const first = send('fixture@example.test');
  const duplicate = send('fixture@example.test');
  assert.equal(first, duplicate);
  assert.equal(sends, 1);
  resolve({ error: null });
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await send('fixture@example.test'), { ok: false, reason: 'recent-request' });
  time += 60_000;
  const next = send('fixture@example.test');
  resolve({ error: null });
  assert.equal((await next).ok, true);
  assert.equal(sends, 2);
});

test('limite do provedor não declara envio e não provoca novas tentativas automáticas', async () => {
  let sends = 0;
  const send = createRecoveryRequest(async () => { sends++; return { error: { code: 'over_email_send_rate_limit', status: 429 } }; });
  assert.deepEqual(await send('fixture@example.test'), { ok: false, reason: 'rate-limit' });
  assert.deepEqual(await send('fixture@example.test'), { ok: false, reason: 'recent-request' });
  assert.equal(sends, 1);
  assert.match(recoveryMessage('rate-limit').message, /não enviou/);
});

test('exceção de rede no envio é tratada sem afirmar que o e-mail foi enviado', async () => {
  const send = createRecoveryRequest(async () => { throw new TypeError('Failed to fetch'); });
  assert.deepEqual(await send('fixture@example.test'), { ok: false, reason: 'network' });
});

test('tela conserva diagnóstico, escapa entrada desconhecida e não libera formulário inválido', () => {
  for (const reason of ['network', 'session-missing', 'expired', 'expired-or-used', 'technical']) {
    const view = recoveryView('new-password', { recoveryStatus: 'invalid', recoveryError: reason });
    assert.ok(view.content.includes(recoveryMessage(reason).title));
    assert.doesNotMatch(view.content, /data-form="new-password"/);
  }
  assert.doesNotMatch(recoveryView('new-password', { recoveryError: '<script>fixture</script>' }).content, /<script>/);
  const ready = recoveryView('new-password', { recoveryStatus: 'ready' }).content;
  assert.match(ready, /data-form="new-password"/);
  assert.match(ready, /Não atualize nem feche/);
  assert.match(ready, /autocomplete="new-password"/);
});

test('bootstrap remove dados da URL, preserva diagnóstico e retorna ao login após recuperar', async () => {
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const cleanUrl = main.indexOf("globalThis.history.replaceState({}, '', '/nova-senha')");
  const exchange = main.indexOf('completePasswordRecoveryCallback(recoveryCallbackUrl)');
  assert.ok(cleanUrl > 0 && cleanUrl < exchange);
  assert.match(main, /recoveryError = !result.ok && !result.offline \? result.code/);
  assert.match(main, /navigate\(recovered \? '\/entrar' : '\/perfil', \{ replace: true \}\)/);
  assert.match(main, /pendingPasswordForms.has\(kind\)/);
  assert.match(main, /pendingPasswordForms.delete\(kind\)/);
});

test('verificador ausente não é apresentado como link expirado', async () => {
  const auth = authFixture();
  auth.exchangeCodeForSession = async () => ({ data: { session: { user: { id: 'fixture-user' } }, redirectType: 'recovery' }, error: { code: 'pkce_code_verifier_not_found' } });
  assert.deepEqual(await createPasswordSecurity(auth).completeRecovery(callback), { ok: false, reason: 'session-missing' });
});

test('erro de rede não vira expiração nem rejeição sem tratamento', async () => {
  const auth = authFixture();
  auth.exchangeCodeForSession = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await createPasswordSecurity(auth).completeRecovery(callback), { ok: false, reason: 'network' });
});

test('callback de login não libera troca de senha por recuperação', async () => {
  const auth = authFixture();
  auth.exchangeCodeForSession = async () => ({ data: { session: { user: { id: 'fixture-user' } }, redirectType: 'signup' }, error: null });
  const security = createPasswordSecurity(auth);
  await security.completeRecovery(callback);
  assert.equal((await security.updateRecovered('fixture-password')).ok, false);
  assert.deepEqual(auth.calls, []);
});
