const environmentProjects = {
  staging: {
    projectName: 'kad-prod',
    projectRef: 'npaoyezfwmgauirrlyog',
    label: 'Homologação temporária',
  },
  production: {
    projectName: 'kad-dev',
    projectRef: 'tknxtwwwoqwbzddplzzg',
    label: 'Produção atual (nome legado)',
  },
} as const;

export type KadEnvironment = keyof typeof environmentProjects;

export type PublicSupabaseConfig = {
  environment: KadEnvironment;
  projectRef: string;
  projectName: string;
  url: string;
  publishableKey: string;
};

export type PublicSupabaseConfigResult =
  | { ok: true; value: PublicSupabaseConfig }
  | { ok: false; reason: string };

const PROJECT_URL_PATTERN = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/;
const PUBLISHABLE_KEY_PATTERN = /^sb_publishable_[A-Za-z0-9_-]+$/;

export const kadEnvironmentProjects = environmentProjects;

export function resolvePublicSupabaseConfig(input: {
  environment?: string;
  url?: string;
  publishableKey?: string;
}): PublicSupabaseConfigResult {
  const environment = input.environment?.trim();
  const url = input.url?.trim();
  const publishableKey = input.publishableKey?.trim();

  if (environment !== 'staging' && environment !== 'production') {
    return { ok: false, reason: 'Ambiente KAD ausente ou inválido.' };
  }

  if (!url || !publishableKey) {
    return { ok: false, reason: `Configuração pública do ambiente ${environment} incompleta.` };
  }

  const project = environmentProjects[environment];
  const projectUrl = PROJECT_URL_PATTERN.exec(url);
  if (!projectUrl || projectUrl[1] !== project.projectRef) {
    return {
      ok: false,
      reason: `O ambiente ${environment} não pode usar outro projeto Supabase.`,
    };
  }

  if (!PUBLISHABLE_KEY_PATTERN.test(publishableKey)) {
    return {
      ok: false,
      reason: 'Use somente uma chave publicável moderna (sb_publishable_).',
    };
  }

  return {
    ok: true,
    value: {
      environment,
      projectRef: project.projectRef,
      projectName: project.projectName,
      url: `https://${project.projectRef}.supabase.co`,
      publishableKey,
    },
  };
}
