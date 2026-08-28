import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';
import {
  kadEnvironmentProjects,
  resolvePublicSupabaseConfig,
} from '../contracts/deployment-environment.ts';

const publishableKey = `sb_publishable_${'A'.repeat(24)}`;

test('cada ambiente aceita somente o projeto Supabase previsto', () => {
  for (const environment of ['staging', 'production'] as const) {
    const project = kadEnvironmentProjects[environment];
    const result = resolvePublicSupabaseConfig({
      environment,
      url: `https://${project.projectRef}.supabase.co`,
      publishableKey,
    });
    assert.equal(result.ok, true);
  }
});

test('produção e homologação não podem apontar uma para a outra', () => {
  const result = resolvePublicSupabaseConfig({
    environment: 'production',
    url: `https://${kadEnvironmentProjects.staging.projectRef}.supabase.co`,
    publishableKey,
  });
  assert.deepEqual(result, {
    ok: false,
    reason: 'O ambiente production não pode usar outro projeto Supabase.',
  });
});

test('chaves antigas, secretas ou service_role são rejeitadas', () => {
  const url = `https://${kadEnvironmentProjects.staging.projectRef}.supabase.co`;
  for (const key of ['anon-jwt', 'sb_secret_x', 'service_role_x', '']) {
    const result = resolvePublicSupabaseConfig({
      environment: 'staging',
      url,
      publishableKey: key,
    });
    assert.equal(result.ok, false);
  }
});

test('perfis EAS fixam ambiente e endereço sem registrar chave', () => {
  const eas = JSON.parse(
    readFileSync(new NodeURL('../eas.json', import.meta.url), 'utf8'),
  ) as { build: Record<string, { env: Record<string, string> }> };
  assert.equal(eas.build.staging.env.EXPO_PUBLIC_KAD_ENV, 'staging');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_KAD_ENV, 'production');
  assert.equal(
    eas.build.staging.env.EXPO_PUBLIC_SUPABASE_URL,
    `https://${kadEnvironmentProjects.staging.projectRef}.supabase.co`,
  );
  assert.equal(
    eas.build.production.env.EXPO_PUBLIC_SUPABASE_URL,
    `https://${kadEnvironmentProjects.production.projectRef}.supabase.co`,
  );
  assert.equal(JSON.stringify(eas).includes('PUBLISHABLE_KEY'), false);
});
