import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
