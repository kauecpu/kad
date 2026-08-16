import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import {
  FEEDBACK_MAX_LENGTH,
  validateFeedbackDraft,
  type FeedbackDraft,
} from '../lib/feedback-rules.ts';

const source = (path: string) => readFileSync(new NodeURL(path, import.meta.url), 'utf8');
const feedbackScreen = source('../app/perfil/feedback.tsx');
const profileScreen = source('../app/(tabs)/perfil.tsx');
const feedbackApi = source('../lib/feedback.ts');
const adminApp = source('../admin/src/app.tsx');
const adminLayout = source('../admin/src/layout/admin-layout.tsx');
const adminFeedbackPage = source('../admin/src/pages/feedback-page.tsx');
const adminFeedbackApi = source('../admin/src/lib/feedback-api.ts');

const draft = (message: string): FeedbackDraft => ({
  category: 'suggestion',
  message,
  sourceScreen: ' perfil/feedback ',
  platform: 'web',
  appVersion: ' 1.0.0 ',
});

test('feedback rejeita comentários vazios ou longos demais', () => {
  assert.deepEqual(validateFeedbackDraft(draft('  ')), {
    ok: false,
    message: 'Conte um pouco mais para conseguirmos entender.',
  });
  assert.equal(validateFeedbackDraft(draft('x'.repeat(FEEDBACK_MAX_LENGTH + 1))).ok, false);
});

test('feedback é normalizado antes do envio', () => {
  const result = validateFeedbackDraft(draft('  Uma sugestão clara.  '));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.message, 'Uma sugestão clara.');
  assert.equal(result.value.sourceScreen, 'perfil/feedback');
  assert.equal(result.value.appVersion, '1.0.0');
});

test('aplicativo envia somente pela RPC autenticada e informa contexto não sensível', () => {
  assert.match(feedbackApi, /rpc\('submit_user_feedback'/);
  assert.doesNotMatch(feedbackApi, /from\(['"]user_feedback['"]\)/);
  assert.match(feedbackScreen, /Constants\.expoConfig\?\.version/);
  assert.match(feedbackScreen, /Platform\.OS/);
  assert.match(feedbackScreen, /Não inclua senha, dados bancários/);
  assert.match(feedbackScreen, /!session/);
  assert.match(profileScreen, /router\.push\('\/perfil\/feedback'\)/);
});

test('painel expõe fila, filtros e os três estados de triagem', () => {
  assert.match(adminApp, /path="feedback"/);
  assert.match(adminLayout, /permission: 'feedback\.read'/);
  assert.match(adminFeedbackApi, /admin_list_user_feedback/);
  assert.match(adminFeedbackApi, /admin_update_user_feedback_status/);
  assert.match(adminFeedbackPage, /'new', 'reviewing', 'resolved'/);
  assert.match(adminFeedbackPage, /Buscar por pessoa ou comentário/);
  assert.match(adminFeedbackPage, /A prévia local não consulta comentários reais/);
});
