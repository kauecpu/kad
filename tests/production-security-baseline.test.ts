import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

const migration = readFileSync(
  new NodeURL(
    '../supabase/migrations/202610080001_production_security_baseline.sql',
    import.meta.url
  ),
  'utf8'
);

const advisorFollowup = readFileSync(
  new NodeURL(
    '../supabase/migrations/202610080002_security_advisor_followup.sql',
    import.meta.url
  ),
  'utf8'
);

const config = readFileSync(new NodeURL('../supabase/config.toml', import.meta.url), 'utf8');
const checklist = readFileSync(
  new NodeURL('../docs/PRODUCTION_SECURITY.md', import.meta.url),
  'utf8'
);

const functionConfig = (name: string) => {
  const match = config.match(
    new RegExp(
      `\\[functions\\.${name}\\]\\s+verify_jwt\\s*=\\s*(true|false)`,
      'm'
    )
  );

  assert.ok(match, `missing Supabase config for ${name}`);
  return match[1] === 'true';
};

test('Edge Functions declare their gateway authentication explicitly', () => {
  for (const name of [
    'cancel-subscription',
    'create-payment-checkout',
    'delete-account',
    'reconcile-payment-checkout',
    'validate-google-purchase',
  ]) {
    assert.equal(functionConfig(name), true, `${name} must require a user JWT`);
  }

  for (const name of ['mercado-pago-webhook', 'send-auth-email']) {
    assert.equal(functionConfig(name), false, `${name} authenticates with its own signature`);
  }
});

test('production baseline removes implicit function execution', () => {
  assert.match(
    migration,
    /alter default privileges for role postgres\s+revoke execute on functions from public/
  );
  assert.match(
    migration,
    /revoke execute on all functions in schema public\s+from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /revoke execute on all functions in schema private\s+from public, anon, authenticated, service_role/
  );
});

test('production baseline keeps only reviewed anonymous and private entry points', () => {
  const anonGrants = migration.match(/grant execute on function .* to anon;/g) ?? [];
  const authenticatedPrivateGrants =
    migration.match(/grant execute on function private\..* to authenticated;/g) ?? [];

  assert.deepEqual(anonGrants, [
    'grant execute on function public.is_username_available(text) to anon;',
  ]);
  assert.deepEqual(authenticatedPrivateGrants, [
    'grant execute on function private.question_community_accuracy(text[]) to authenticated;',
  ]);
});

test('future public relations require explicit client grants', () => {
  assert.match(
    migration,
    /alter default privileges for role postgres in schema public\s+revoke all on tables from anon, authenticated/
  );
  assert.match(
    migration,
    /alter default privileges for role postgres in schema public\s+revoke all on sequences from anon, authenticated/
  );
  assert.match(migration, /revoke create on schema public from public, anon, authenticated/);
});

test('advisor-reported foreign keys have supporting indexes', () => {
  assert.match(
    migration,
    /create index if not exists question_answer_evidence_import_batch_id_idx\s+on private\.question_answer_evidence \(import_batch_id\)/
  );
  assert.match(
    migration,
    /create index if not exists questions_withdrawn_by_idx\s+on public\.questions \(withdrawn_by\)/
  );
});

test('advisor follow-up indexes the achievement definition foreign key', () => {
  assert.match(
    advisorFollowup,
    /create index if not exists user_achievements_achievement_key_idx\s+on public\.user_achievements \(achievement_key\)/
  );
});

test('baseline preserves the critical authenticated and service RPCs', () => {
  for (const signature of [
    'public.record_question_attempt(text, text) to authenticated',
    'public.get_current_subscription() to authenticated',
    'public.get_ranking(text, integer, integer) to authenticated',
    'public.claim_payment_webhook(text, text, text, text, boolean) to service_role',
    'public.apply_google_play_purchase(uuid, text, text, text, text, timestamptz, boolean, boolean) to service_role',
  ]) {
    assert.ok(migration.includes(`grant execute on function ${signature};`), signature);
  }
});

test('production checklist keeps dashboard-only controls sequenced safely', () => {
  assert.match(checklist, /proteção contra senhas vazadas/i);
  assert.match(checklist, /SMTP próprio/);
  assert.match(checklist, /SPF, DKIM e DMARC/);
  assert.match(checklist, /Integrar CAPTCHA no app e no site antes de ativá-lo/);
  assert.match(checklist, /sem curingas amplos em produção/);
});
