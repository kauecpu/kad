import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { kadEnvironmentProjects as projects } from '../contracts/deployment-environment.ts';

const [, , environment, target, action] = process.argv;
const root = resolve(import.meta.dirname, '..');
const commands = {
  app: {
    start: ['npx', ['expo', 'start']],
    web: ['npx', ['expo', 'start', '--web']],
    build: ['npx', ['expo', 'export']],
  },
  site: {
    start: ['npm', ['--prefix', 'site', 'run', 'dev']],
    build: ['npm', ['--prefix', 'site', 'run', 'build']],
  },
  admin: {
    start: ['npm', ['--prefix', 'admin', 'run', 'dev']],
    build: ['npm', ['--prefix', 'admin', 'run', 'build']],
  },
};

function fail(message) {
  console.error(`Ambiente não iniciado: ${message}`);
  process.exit(1);
}

function readEnvironmentFile(path) {
  if (!existsSync(path)) {
    fail(`crie ${path} a partir do arquivo de exemplo correspondente.`);
  }
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator < 1) fail(`linha inválida em ${path}.`);
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

if (!projects[environment]) fail('use staging ou production.');
if (!commands[target]) fail('use app, site ou admin.');
if (action !== 'check' && !commands[target][action]) fail('ação inválida.');

const localEnv = readEnvironmentFile(resolve(root, `.env.${environment}.local`));
const publishableKey = localEnv.SUPABASE_PUBLISHABLE_KEY;
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey ?? '')) {
  fail('a chave deve ser publicável e começar com sb_publishable_.');
}
if (Object.keys(localEnv).some((name) => /service|secret|password|token/i.test(name))) {
  fail('o arquivo público contém uma variável proibida.');
}

const project = projects[environment];
const url = `https://${project.projectRef}.supabase.co`;
const publicVariables = {
  EXPO_PUBLIC_KAD_ENV: environment,
  EXPO_PUBLIC_SUPABASE_URL: url,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  VITE_KAD_ENV: environment,
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
};

async function verifyProject() {
  const response = await fetch(`${url}/rest/v1/questions?select=id&limit=0`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
  });
  if (!response.ok) {
    fail(`a chave não foi aceita pelo projeto ${project.projectRef} (${response.status}).`);
  }
}

await verifyProject();
console.log(`${project.label} verificada: ${project.projectName} (${project.projectRef}).`);
if (action === 'check') process.exit(0);

const [command, args] = commands[target][action];
const result = spawnSync(command, args, {
  cwd: root,
  env: { ...process.env, ...publicVariables },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
