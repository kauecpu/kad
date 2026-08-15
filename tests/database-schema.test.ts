import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

const migration = readFileSync(
  new NodeURL('../supabase/migrations/202608010002_user_study_data.sql', import.meta.url),
  'utf8'
);

const hardeningMigration = readFileSync(
  new NodeURL('../supabase/migrations/202608020001_harden_database.sql', import.meta.url),
  'utf8'
);

const authMigration = readFileSync(
  new NodeURL('../supabase/migrations/202608010001_auth_profiles.sql', import.meta.url),
  'utf8'
);

const usernameMigration = readFileSync(
  new NodeURL('../supabase/migrations/202608020002_profile_usernames.sql', import.meta.url),
  'utf8'
);

const authHardeningMigration = readFileSync(
  new NodeURL('../supabase/migrations/202608020003_harden_auth_security.sql', import.meta.url),
  'utf8'
);

const adminMigration = readFileSync(
  new NodeURL('../supabase/migrations/202608020004_admin_foundation.sql', import.meta.url),
  'utf8'
);

const editorialConcursosMigration = readFileSync(
  new NodeURL('../supabase/migrations/202608020005_editorial_concursos.sql', import.meta.url),
  'utf8'
);

const editorialImportMigration = readFileSync(
  new NodeURL('../supabase/migrations/202608090001_editorial_import_pipeline.sql', import.meta.url),
  'utf8'
);

const paymentsMigration = readFileSync(
  new NodeURL('../supabase/migrations/202608110001_payments_subscriptions.sql', import.meta.url),
  'utf8'
);

const paymentHardeningMigration = readFileSync(
  new NodeURL(
    '../supabase/migrations/20260812024756_harden_payment_subscriptions.sql',
    import.meta.url
  ),
  'utf8'
);

const paymentCatalog = readFileSync(
  new NodeURL('../supabase/functions/_shared/mercado-pago.ts', import.meta.url),
  'utf8'
);

const paymentWebhook = readFileSync(
  new NodeURL('../supabase/functions/mercado-pago-webhook/index.ts', import.meta.url),
  'utf8'
);

const paymentCheckout = readFileSync(
  new NodeURL('../supabase/functions/create-payment-checkout/index.ts', import.meta.url),
  'utf8'
);

const supabaseConfig = readFileSync(
  new NodeURL('../supabase/config.toml', import.meta.url),
  'utf8'
);

const deleteAccountFunction = readFileSync(
  new NodeURL('../supabase/functions/delete-account/index.ts', import.meta.url),
  'utf8'
);

const confirmationEmailTemplate = readFileSync(
  new NodeURL('../supabase/templates/confirmation.html', import.meta.url),
  'utf8'
);

const recoveryEmailTemplate = readFileSync(
  new NodeURL('../supabase/templates/recovery.html', import.meta.url),
  'utf8'
);

const migrationNames = readdirSync(
  new NodeURL('../supabase/migrations/', import.meta.url)
);

const readMigration = (name: string) =>
  readFileSync(new NodeURL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

test('dados pessoais e de estudo possuem RLS', () => {
  for (const table of [
    'question_attempts',
    'question_favorites',
    'saved_concursos',
    'question_comments',
    'comment_likes',
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test('exclusão de conta privilegiada não permanece como RPC pública', () => {
  assert.match(migration, /drop function if exists public\.delete_own_account\(\)/);
  assert.doesNotMatch(migration, /create or replace function public\.delete_own_account/);
});

test('tabelas financeiras possuem RLS e não expõem auditoria ao aplicativo', () => {
  for (const table of [
    'payment_checkout_sessions',
    'subscriptions',
    'payment_transactions',
    'payment_webhook_events',
  ]) {
    assert.match(
      paymentsMigration,
      new RegExp(`alter table public\\.${table} enable row level security`)
    );
  }
  assert.match(
    paymentsMigration,
    /revoke all on public\.payment_transactions from anon, authenticated/
  );
  assert.match(
    paymentsMigration,
    /revoke all on public\.payment_webhook_events from anon, authenticated/
  );
  assert.match(paymentsMigration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
});

test('RPCs financeiras privilegiadas são exclusivas do service role', () => {
  assert.match(
    paymentsMigration,
    /revoke all on function public\.apply_mercado_pago_payment\([\s\S]*?from public, anon, authenticated/
  );
  assert.match(
    paymentsMigration,
    /grant execute on function public\.apply_mercado_pago_payment\([\s\S]*?to service_role/
  );
  assert.match(
    paymentsMigration,
    /revoke all on function public\.sync_mercado_pago_subscription\(text, text\)[\s\S]*?from public, anon, authenticated/
  );
});

test('preço vem do servidor e a conciliação confere valor e moeda', () => {
  assert.match(paymentCatalog, /amountCents: 1499/);
  assert.match(paymentCatalog, /amountCents: 3999/);
  assert.match(paymentCatalog, /amountCents: 14999/);
  assert.match(
    paymentsMigration,
    /checkout\.amount_cents <> p_amount_cents or checkout\.currency <> upper\(p_currency\)/
  );
  assert.match(paymentsMigration, /provider_payment_id text primary key/);
});

test('webhook financeiro exige HMAC e consulta o recurso no provedor', () => {
  assert.match(paymentCatalog, /crypto\.subtle\.sign\('HMAC'/);
  assert.match(paymentCatalog, /request-id:/);
  assert.match(paymentCatalog, /ts:/);
  assert.match(paymentWebhook, /Invalid signature/);
  assert.match(paymentWebhook, /mercadoPagoRequest<MercadoPagoPayment>/);
  assert.match(supabaseConfig, /\[functions\.mercado-pago-webhook\]/);
  assert.match(supabaseConfig, /verify_jwt = false/);
});

test('checkout financeiro usa rate limiting concorrente no banco antes do provedor', () => {
  assert.match(paymentHardeningMigration, /private\.payment_checkout_rate_limits/);
  assert.match(paymentHardeningMigration, /pg_advisory_xact_lock/);
  assert.match(paymentHardeningMigration, /attempt_count/);
  assert.match(paymentHardeningMigration, /lease_expires_at/);
  assert.match(paymentHardeningMigration, /interval '15 minutes'/);
  assert.match(paymentHardeningMigration, /interval '10 seconds'/);
  assert.match(paymentCheckout, /acquire_payment_checkout_lease/);
  assert.match(paymentCheckout, /consume_payment_checkout_attempt/);
  assert.match(paymentCheckout, /status: 429/);
  assert.match(paymentCheckout, /'Retry-After'/);

  const limiterPosition = paymentCheckout.indexOf('consume_payment_checkout_attempt');
  const cancellationPosition = paymentCheckout.indexOf('await cancelPendingProviderSubscription');
  const creationPosition = paymentCheckout.indexOf("'/preapproval'");
  assert.ok(limiterPosition >= 0 && limiterPosition < cancellationPosition);
  assert.ok(limiterPosition < creationPosition);
});

test('crédito de pagamento é imutável e estados de estorno são terminais', () => {
  assert.match(paymentHardeningMigration, /credit_applied_at timestamptz/);
  assert.match(paymentHardeningMigration, /provider_observed_at timestamptz/);
  assert.match(paymentHardeningMigration, /terminal_status text/);
  assert.match(paymentHardeningMigration, /protect_payment_transaction_markers/);
  assert.match(paymentHardeningMigration, /credit_applied_at is null/);
  assert.match(paymentHardeningMigration, /terminal_status is not null/);
  assert.match(paymentHardeningMigration, /p_provider_observed_at/);
  assert.match(
    paymentHardeningMigration,
    /if not incoming_is_terminal[\s\S]*?p_provider_observed_at < previous_transaction\.provider_observed_at then/
  );
  assert.match(
    paymentHardeningMigration,
    /revoke all on function public\.apply_mercado_pago_payment\([\s\S]*?from public, anon, authenticated/
  );
  assert.match(
    paymentHardeningMigration,
    /grant execute on function public\.apply_mercado_pago_payment\([\s\S]*?to service_role/
  );
  assert.match(paymentWebhook, /date_last_updated/);
  assert.match(paymentWebhook, /last_modified/);
  assert.match(paymentWebhook, /p_provider_observed_at/);
});

test('agregação comunitária privilegiada fica no schema privado', () => {
  assert.match(migration, /function private\.question_community_accuracy/);
  assert.match(migration, /function public\.question_community_accuracy/);
});

test('profile write grants are limited to public fields', () => {
  assert.match(migration, /revoke insert, update, delete on public\.profiles from authenticated/);
  assert.match(
    migration,
    /grant update \(name, phone, city, target_role\) on public\.profiles to authenticated/
  );
});

test('comment author is derived from the authenticated profile', () => {
  assert.match(migration, /function private\.set_comment_author\(\)/);
  assert.match(migration, /before insert on public\.question_comments/);
});

test('automatic RLS helper is not executable by client roles', () => {
  assert.match(
    hardeningMigration,
    /revoke execute on function public\.rls_auto_enable\(\) from public, anon, authenticated/
  );
});

test('foreign keys used during account deletion are indexed', () => {
  assert.match(hardeningMigration, /question_comments_user_id_idx/);
  assert.match(hardeningMigration, /comment_likes_user_id_idx/);
});

test('UUID de autenticação permanece como chave primária do perfil', () => {
  assert.match(authMigration, /id uuid primary key references auth\.users \(id\)/);
});

test('nome de usuário é público, único e validado no banco', () => {
  assert.match(usernameMigration, /profiles_username_format/);
  assert.match(usernameMigration, /profiles_username_lower_unique/);
  assert.match(usernameMigration, /function public\.is_username_available/);
  assert.match(usernameMigration, /grant execute .* to anon, authenticated/);
  assert.match(usernameMigration, /new\.raw_user_meta_data ->> 'username'/);
});

test('consulta pública de usuário não executa com privilégios elevados', () => {
  assert.match(authHardeningMigration, /security invoker/);
  assert.doesNotMatch(authHardeningMigration, /security definer/);
  assert.match(authHardeningMigration, /grant select \(username\) on public\.profiles to anon/);
  assert.match(
    authHardeningMigration,
    /grant execute on function public\.is_username_available\(text\) to anon/
  );
  assert.match(
    authHardeningMigration,
    /revoke all on function public\.is_username_available\(text\) from public, anon, authenticated/
  );
});

test('papéis administrativos ficam fora do schema público', () => {
  assert.match(adminMigration, /create table if not exists private\.admin_users/);
  assert.match(adminMigration, /alter table private\.admin_users enable row level security/);
  assert.match(
    adminMigration,
    /revoke all on table private\.admin_users from public, anon, authenticated/
  );
});

test('acesso ao painel é decidido no banco e não pelo frontend', () => {
  assert.match(adminMigration, /function private\.has_admin_permission\(p_permission text\)/);
  assert.match(adminMigration, /admin_user\.user_id = auth\.uid\(\)/);
  assert.match(adminMigration, /and admin_user\.active/);
  assert.match(adminMigration, /grant execute on function public\.get_my_admin_access\(\) to authenticated/);
  assert.match(adminMigration, /revoke all on function public\.get_my_admin_access\(\) from public, anon/);
});

test('métricas administrativas exigem permissão explícita', () => {
  assert.match(adminMigration, /private\.has_admin_permission\('dashboard\.read'\)/);
  assert.match(adminMigration, /raise exception 'Admin permission required'/);
  assert.match(adminMigration, /grant execute on function public\.admin_dashboard_summary\(\) to authenticated/);
  assert.match(adminMigration, /revoke all on function public\.admin_dashboard_summary\(\) from public, anon/);
});

test('concursos editoriais expõem somente conteúdo publicado ao aplicativo', () => {
  assert.match(editorialConcursosMigration, /create table if not exists public\.concursos/);
  assert.match(editorialConcursosMigration, /create table if not exists public\.concurso_roles/);
  assert.match(editorialConcursosMigration, /alter table public\.concursos enable row level security/);
  assert.match(editorialConcursosMigration, /publication_status = 'published'/);
  assert.match(editorialConcursosMigration, /grant select on table public\.concursos to anon, authenticated/);
});

test('mutações de concursos exigem permissão e registram auditoria', () => {
  assert.match(editorialConcursosMigration, /function public\.admin_save_concurso\(p_concurso jsonb\)/);
  assert.match(editorialConcursosMigration, /private\.has_admin_permission\('content\.write'\)/);
  assert.match(editorialConcursosMigration, /private\.has_admin_permission\('content\.publish'\)/);
  assert.match(editorialConcursosMigration, /insert into private\.admin_audit_logs/);
  assert.match(editorialConcursosMigration, /function public\.admin_delete_concurso\(p_concurso_id text\)/);
  assert.match(editorialConcursosMigration, /revoke all on function public\.admin_save_concurso\(jsonb\) from public, anon/);
});

test('lotes editoriais ficam privados e são acessados somente por RPC protegida', () => {
  assert.match(editorialImportMigration, /create table if not exists private\.editorial_import_batches/);
  assert.match(editorialImportMigration, /create table if not exists private\.editorial_import_items/);
  assert.match(editorialImportMigration, /alter table private\.editorial_import_batches enable row level security/);
  assert.match(editorialImportMigration, /revoke all on table private\.editorial_import_items from public, anon, authenticated/);
  assert.match(editorialImportMigration, /function public\.admin_create_import_batch/);
  assert.match(editorialImportMigration, /function public\.admin_update_import_item/);
  assert.match(editorialImportMigration, /private\.has_admin_permission\('content\.write'\)/);
});

test('questões importadas só ficam públicas depois da revisão editorial', () => {
  assert.match(editorialImportMigration, /create table if not exists public\.questions/);
  assert.match(editorialImportMigration, /using \(publication_status = 'published'\)/);
  assert.match(editorialImportMigration, /jsonb_build_object\(\s*'publicationStatus', 'draft'/);
  assert.match(editorialImportMigration, /private\.has_admin_permission\('content\.publish'\)/);
  assert.match(editorialImportMigration, /function public\.admin_save_question/);
});

test('pipeline detecta duplicatas, audita e protege rollback de conteúdo publicado', () => {
  assert.match(editorialImportMigration, /questions_source_identity_idx/);
  assert.match(editorialImportMigration, /concursos_source_identity_idx/);
  assert.match(editorialImportMigration, /'import\.applied'/);
  assert.match(editorialImportMigration, /'import\.item_updated'/);
  assert.match(editorialImportMigration, /'import\.rolled_back'/);
  assert.match(editorialImportMigration, /v_current_status = 'published'/);
  assert.match(editorialImportMigration, /v_current_batch is distinct from p_batch_id/);
  assert.match(editorialImportMigration, /v_current_updated_at > v_item\.imported_at/);
});

test('exclusão de conta confirma a senha no servidor e aceita origens configuradas', () => {
  assert.match(deleteAccountFunction, /ALLOWED_WEB_ORIGINS/);
  assert.match(deleteAccountFunction, /http:\/\/localhost:8082/);
  assert.match(deleteAccountFunction, /http:\/\/127\.0\.0\.1:8082/);
  assert.match(deleteAccountFunction, /auth\.signInWithPassword/);
  assert.match(deleteAccountFunction, /auth\.admin\.deleteUser\(user\.id\)/);
  assert.match(deleteAccountFunction, /Origin not allowed/);
});

test('templates de autenticação usam OTP e recuperação em português', () => {
  assert.match(confirmationEmailTemplate, /\{\{ \.Token \}\}/);
  assert.match(recoveryEmailTemplate, /lang="pt-BR"/);
  assert.match(recoveryEmailTemplate, /Redefina sua senha/);
  assert.match(recoveryEmailTemplate, /\{\{ \.ConfirmationURL \}\}/);
});

test('histórico remoto de pagamentos possui espelhos locais auditáveis', () => {
  for (const versionedName of [
    '20260812211105_harden_payment_subscriptions.sql',
    '20260812221545_grant_payment_edge_function_access.sql',
    '20260812225749_enforce_payment_edge_function_least_privilege.sql',
  ]) {
    assert.ok(migrationNames.includes(versionedName), `${versionedName} must exist locally`);
  }

  const duplicateHardeningMirror = readMigration(
    '20260812211105_harden_payment_subscriptions.sql'
  );
  const executableMirrorSql = duplicateHardeningMirror
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .trim();
  assert.equal(
    executableMirrorSql,
    '',
    'the duplicate remote timestamp must be a non-executable historical mirror'
  );
  assert.match(duplicateHardeningMirror, /20260812024756_harden_payment_subscriptions\.sql/);
  assert.match(duplicateHardeningMirror, /116abfe9ccfd113c23a3bd400ca02c7b/);
});

test('reconciliação remove privilégios destrutivos e corrige índices de FKs', () => {
  const reconciliationName = migrationNames.find((name) =>
    name.endsWith('_reconcile_remote_schema.sql')
  );
  assert.ok(reconciliationName, 'reconcile_remote_schema migration must exist');

  const reconciliationSql = readMigration(reconciliationName);
  assert.match(
    reconciliationSql,
    /revoke truncate, references, trigger\s+on all tables in schema public\s+from anon, authenticated, service_role/
  );
  assert.match(
    reconciliationSql,
    /alter default privileges for role postgres in schema public\s+revoke truncate, references, trigger on tables\s+from anon, authenticated, service_role/
  );
  assert.doesNotMatch(
    reconciliationSql,
    /alter default privileges for role supabase_admin/,
    'migration runner is not a member of supabase_admin'
  );

  for (const indexName of [
    'admin_audit_logs_actor_id_idx',
    'admin_users_created_by_idx',
    'concursos_created_by_idx',
    'concursos_updated_by_idx',
    'payment_transactions_checkout_session_id_idx',
  ]) {
    assert.match(reconciliationSql, new RegExp(`create index if not exists ${indexName}`));
  }

  const editorialIndexMigrationName = migrationNames.find((name) =>
    name.endsWith('_complete_editorial_fk_indexes.sql')
  );
  assert.ok(editorialIndexMigrationName, 'complete_editorial_fk_indexes migration must exist');

  const editorialIndexSql = readMigration(editorialIndexMigrationName);
  for (const indexName of [
    'editorial_import_batches_created_by_idx',
    'questions_created_by_idx',
    'questions_updated_by_idx',
  ]) {
    assert.match(editorialIndexSql, new RegExp(`create index if not exists ${indexName}`));
  }
});
