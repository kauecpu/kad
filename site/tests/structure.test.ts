import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL as NodeUrl, fileURLToPath } from 'node:url';

const projectUrl = new NodeUrl('../', import.meta.url);

async function source(path: string): Promise<string> {
  return readFile(fileURLToPath(new NodeUrl(path, projectUrl)), 'utf8');
}

test('HTML inicial inclui metadados essenciais e conteúdo alternativo', async () => {
  const html = await source('index.html');
  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /name="description"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /<noscript>/);
});

test('regras isolam site, aplicativo e credenciais administrativas', async () => {
  const [rootRules, appRules, siteRules] = await Promise.all([
    source('../AGENTS.md'),
    source('../app/AGENTS.md'),
    source('AGENTS.md'),
  ]);
  assert.match(rootRules, /Limites entre aplicativo e site/);
  assert.match(appRules, /Não altere `site\/`/);
  assert.match(siteRules, /Não altere `app\/`/);
  assert.match(siteRules, /nunca registre chaves, tokens, cookies ou `service_role`/);
});

test('skill visual do site preserva stack, identidade e autenticação', async () => {
  const [skill, constraints, siteRules] = await Promise.all([
    source('../.agents/skills/kad-site-ui/SKILL.md'),
    source('../.agents/skills/kad-site-ui/references/kad-site-constraints.md'),
    source('AGENTS.md'),
  ]);
  assert.match(skill, /name: kad-site-ui/);
  assert.match(skill, /Não adicionar Tailwind, React ou outro framework/);
  assert.match(constraints, /Não remover a tela de login/);
  assert.match(constraints, /Não exibir métricas pessoais antes da entrada/);
  assert.match(siteRules, /skill local `kad-site-ui`/);
});

test('rotas privadas são excluídas de indexação no robots', async () => {
  const robots = await source('public/robots.txt');
  assert.match(robots, /Disallow: \/perfil\//);
  assert.match(robots, /Disallow: \/simulados\/em-andamento/);
});

test('integrações web reutilizam RPCs seguras e apenas a chave pública', async () => {
  const service = await source('src/services/supabase.ts');
  assert.match(service, /VITE_SUPABASE_ANON_KEY/);
  assert.match(service, /rpc\('record_question_attempt'/);
  assert.match(service, /rpc\('submit_user_feedback'/);
  assert.match(service, /create-payment-checkout/);
  assert.match(service, /mercadopago\.com\.br/);
  assert.doesNotMatch(service, /service_role|SUPABASE_SERVICE/);
});

test('apresentação pública usa somente imagens existentes e não inventa métricas pessoais', async () => {
  const [view, explore, assets] = await Promise.all([
    source('src/views/public.ts'),
    source('src/views/explore.ts'),
    Promise.all([
      source('public/assets/kad-logo.png'),
      source('public/assets/kad-mascot-goal.png'),
    ]),
  ]);
  assert.equal(assets.length, 2);
  assert.match(view, /kad-mascot-goal\.png/);
  assert.match(explore, /kad-mascot-goal\.png/);
  assert.doesNotMatch(`${view}${explore}`, /kad-mascot-study\.png/);
  assert.doesNotMatch(view, /82%|\+12 questões|acerto esta semana|ritmo de hoje/);
});

test('layout web usa autenticação dividida, resumos compactos e comentários legíveis', async () => {
  const [publicView, questionsView, styles] = await Promise.all([
    source('src/views/public.ts'),
    source('src/views/questions.ts'),
    source('src/styles/app.css'),
  ]);
  assert.match(publicView, /auth-page auth-page--split/);
  assert.match(publicView, /auth-story__slides/);
  assert.match(publicView, /auth-card auth-card--portal/);
  assert.match(questionsView, /summary-grid summary-grid--strip/);
  assert.match(questionsView, /discipline-card__copy/);
  assert.match(questionsView, /<textarea class="textarea"[^>]+rows="3"/);
  assert.match(styles, /\.comment-form \.button \{ width: 100%; \}/);
});

test('login cabe em desktops baixos sem ocultar conteúdo', async () => {
  const styles = await source('src/styles/app.css');

  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) minmax\(340px, 370px\)/);
  assert.match(styles, /min-height: min\(700px, calc\(100dvh - 126px\)\)/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]+grid-template-areas: 'access' 'story'/);
});

test('entrada apresenta recursos reais em carrossel controlável e sensível a movimento', async () => {
  const [publicView, main, styles] = await Promise.all([
    source('src/views/public.ts'),
    source('src/main.ts'),
    source('src/styles/app.css'),
  ]);

  assert.match(publicView, /data-auth-carousel/);
  assert.match(publicView, /data-action="pause-auth-story"/);
  assert.match(publicView, /kad-mascot-practice\.png/);
  assert.match(publicView, /kad-mascot-simulation\.png/);
  assert.match(publicView, /kad-mascot-writing\.png/);
  assert.match(publicView, /kad-mascot-goal\.png/);
  assert.match(main, /AUTH_STORY_INTERVAL = 6500/);
  assert.match(main, /prefers-reduced-motion: reduce/);
  assert.match(main, /pointerover/);
  assert.match(main, /focusin/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('melhorias de interface preservam semântica, privacidade e linguagem de produto', async () => {
  const [publicView, questionsView, simulationsView, components, layout, styles] = await Promise.all([
    source('src/views/public.ts'),
    source('src/views/questions.ts'),
    source('src/views/simulations.ts'),
    source('src/ui/components.ts'),
    source('src/ui/layout.ts'),
    source('src/styles/base.css'),
  ]);

  assert.match(components, /data-action="toggle-password"/);
  assert.match(publicView, /continuar como visitante/i);
  assert.doesNotMatch(publicView, /Supabase ainda não estiver configurado/);
  assert.match(layout, /stack-header[\s\S]+<h2>/);
  assert.doesNotMatch(layout, /stack-header[\s\S]+<h1>/);
  assert.match(questionsView, /comments-disclosure/);
  assert.match(questionsView, /Pular questão/);
  assert.match(simulationsView, /questão disponível/);
  assert.doesNotMatch(simulationsView, /versão web|Frontend|Treino fiel ao app/);
  assert.match(styles, /--text-subtle: #5f6c7d/);
  assert.match(styles, /scroll-padding-bottom/);
});
