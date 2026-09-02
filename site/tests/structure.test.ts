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
  assert.match(service, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(service, /VITE_KAD_ENV/);
  assert.match(service, /rpc\('record_question_attempt'/);
  assert.match(service, /rpc\('submit_user_feedback'/);
  assert.match(service, /create-payment-checkout/);
  assert.match(service, /get_payment_checkout_status/);
  assert.match(service, /mercadopago\.com\.br/);
  assert.match(service, /from\('flashcard_decks'\)/);
  assert.match(service, /from\('flashcards'\)/);
  assert.match(service, /from\('flashcard_reviews'\)/);
  assert.match(service, /rpc\('sync_essay_document'/);
  assert.match(service, /rpc\('sync_simulation_session'/);
  assert.match(service, /from\('question_comments'\)/);
  assert.match(service, /delete-account/);
  assert.doesNotMatch(service, /service_role|SUPABASE_SERVICE/);
});

test('retorno do Mercado Pago mostra estados finais sem confiar na URL', async () => {
  const [main, profile, service] = await Promise.all([
    source('src/main.ts'),
    source('src/views/profile.ts'),
    source('src/services/supabase.ts'),
  ]);
  assert.match(main, /loadRemoteCheckoutStatus\(checkoutId\)/);
  assert.match(main, /checkout\?\.status === 'approved'/);
  assert.match(main, /\['failed', 'canceled', 'expired'\]/);
  assert.match(profile, /Pagamento confirmado/);
  assert.match(profile, /Pagamento não aprovado/);
  assert.match(profile, /Checkout expirado/);
  assert.match(service, /context\.clone\(\)\.json\(\)/);
  assert.doesNotMatch(service, /service_role|SUPABASE_SERVICE/);
});

test('site expõe flashcards e sincronização de estudo sem importar o aplicativo', async () => {
  const [view, navigation, main, flashcards, worker] = await Promise.all([
    source('src/views/flashcards.ts'),
    source('src/ui/navigation.ts'),
    source('src/main.ts'),
    source('src/core/flashcards.ts'),
    source('server/index.ts'),
  ]);

  assert.match(navigation, /href: '\/flashcards'/);
  assert.match(main, /pathname === '\/flashcards\/revisar'/);
  assert.match(main, /hydrateAuthenticatedUser/);
  assert.match(view, /class="flashcard-workspace"/);
  assert.match(view, /data-action="rate-flashcard"/);
  assert.match(flashcards, /export function scheduleReview/);
  assert.doesNotMatch(`${view}${main}${flashcards}`, /react-native|expo-router/);
  assert.match(worker, /\/api\/public-config/);
  assert.match(worker, /SUPABASE_PUBLISHABLE_KEY/);
});

test('apresentação pública usa somente conteúdo real e não exibe mascotes decorativos', async () => {
  const [view, explore, assets] = await Promise.all([
    source('src/views/public.ts'),
    source('src/views/explore.ts'),
    Promise.all([
      source('public/assets/kad-logo.png'),
    ]),
  ]);
  assert.equal(assets.length, 1);
  assert.match(view, /landing-hero__panel/);
  assert.doesNotMatch(`${view}${explore}`, /kad-mascot-/);
  assert.doesNotMatch(view, /82%|\+12 questões|acerto esta semana|ritmo de hoje/);
});

test('ranking e trilhas toleram questões sem dificuldade', async () => {
  const explore = await source('src/views/explore.ts');
  assert.match(explore, /question\?\.difficulty/);
  assert.match(explore, /left\.difficulty \?/);
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
  assert.match(questionsView, /class="catalog-progress"/);
  assert.match(questionsView, /subjectIndexRow/);
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
  assert.match(publicView, /auth-story__copy/);
  assert.doesNotMatch(publicView, /kad-mascot-/);
  assert.match(main, /AUTH_STORY_INTERVAL = 6500/);
  assert.match(main, /prefers-reduced-motion: reduce/);
  assert.match(main, /pointerover/);
  assert.match(main, /focusin/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('sinal visual do KAD é vetorial, contido e substitui os placeholders rejeitados', async () => {
  const [brand, publicView, components, styles, home] = await Promise.all([
    source('src/ui/brand.ts'),
    source('src/views/public.ts'),
    source('src/ui/components.ts'),
    source('src/styles/app.css'),
    source('src/views/home.ts'),
  ]);

  assert.match(brand, /export function kadSignalMark/);
  assert.match(brand, /<svg[\s\S]+viewBox="0 0 64 88"/);
  assert.match(brand, /variant\?: 'color' \| 'mono' \| 'compact'/);
  assert.match(publicView, /kadSignalMark/);
  assert.match(publicView, /landing-hero__features/);
  assert.doesNotMatch(`${publicView}${components}${home}`, /landing-note|landing-hero__stamp|landing-hero__bolt|auth-story__mark|workspace-hero__mark|home-intro__mark/);
  assert.doesNotMatch(components, /imageSrc|kad-mascot-/);
  assert.match(styles, /--kad-signal-yellow:\s*#/);
  assert.match(styles, /\.kad-signal--compact/);
  assert.doesNotMatch(styles, /\.home-intro \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 210px/);
  assert.match(styles, /\.kad-signal \{[^}]*overflow:\s*hidden/);
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
  assert.match(publicView, /data-public-auth-visitor/);
  assert.match(publicView, /action: 'continue-visitor'/);
  assert.match(publicView, /Acessar como visitante/);
  assert.doesNotMatch(publicView, /Supabase ainda não estiver configurado/);
  assert.match(layout, /class="stack-header"/);
  assert.doesNotMatch(layout, /stack-header[^`]+<h[1-6]/);
  assert.match(layout, /<main id="conteudo" class="page-content"[\s\S]+<\/main>/);
  assert.match(layout, /<h1>\$\{escapeHtml\(title\)\}<\/h1>/);
  assert.match(questionsView, /comments-disclosure/);
  assert.match(questionsView, /Pular questão/);
  assert.match(simulationsView, /questão disponível/);
  assert.doesNotMatch(simulationsView, /versão web|Frontend|Treino fiel ao app/);
  assert.match(styles, /--text-subtle: #5f5f5f/);
  assert.match(styles, /scroll-padding-bottom/);
});

test('correções móveis reservam espaço para navegação e ampliam alvos de toque', async () => {
  const [baseStyles, appStyles, profile] = await Promise.all([
    source('src/styles/base.css'),
    source('src/styles/app.css'),
    source('src/views/profile.ts'),
  ]);

  assert.match(baseStyles, /--mobile-tabs-clearance:/);
  assert.match(baseStyles, /\.segmented button \{ min-height: 44px/);
  assert.match(baseStyles, /\.chip \{ min-height: 44px/);
  assert.match(appStyles, /\.app-column \{ height: calc\(100vh - var\(--mobile-tabs-clearance\)\)/);
  assert.match(appStyles, /\.mobile-tabs \{[^}]+height: var\(--mobile-tabs-height\)/);
  assert.match(appStyles, /\.question-map button \{ min-width: 44px; min-height: 44px/);
  assert.match(appStyles, /\.comment__actions button \{[^}]+min-height: 44px/);
  assert.match(appStyles, /\.profile-legal-links a \{[^}]+min-height: 44px/);
  assert.match(profile, /profile-legal-links/);
});

test('navegação interna agrupa tarefas e oferece no máximo cinco destinos móveis', async () => {
  const [navigation, layout, main, styles] = await Promise.all([
    source('src/ui/navigation.ts'),
    source('src/ui/layout.ts'),
    source('src/main.ts'),
    source('src/styles/app.css'),
  ]);

  for (const group of ['Estudar', 'Preparar', 'Acompanhar']) assert.match(navigation, new RegExp(`label: '${group}'`));
  for (const route of ['/questoes', '/simulados', '/trilhas', '/concursos', '/perfil']) assert.match(navigation, new RegExp(`href: '${route}'`));
  assert.match(layout, /mobilePrimaryNavigation\.map/);
  assert.match(layout, /<span>Mais<\/span>/);
  assert.match(layout, /sidebar__group/);
  assert.match(main, /navigationTrigger/);
  assert.match(main, /closeNavigation\(\)/);
  assert.match(main, /event\.key === 'Tab'/);
  assert.match(styles, /\.sidebar__navigation \{[^}]+overflow-y: auto/);
  assert.match(styles, /\.nav-link--more \{[^}]+background: transparent/);
});

test('hierarquia interna prioriza cabeçalho compacto, ação e revelação progressiva', async () => {
  const [components, questions, flashcards, profile, explore, styles] = await Promise.all([
    source('src/ui/components.ts'),
    source('src/views/questions.ts'),
    source('src/views/flashcards.ts'),
    source('src/views/profile.ts'),
    source('src/views/explore.ts'),
    source('src/styles/app.css'),
  ]);

  assert.match(components, /workspace-hero__actions/);
  assert.match(questions, /class="question-search-panel"/);
  assert.match(questions, /class="filter-disclosure"/);
  assert.doesNotMatch(flashcards, /class="creation-panel" open/);
  assert.match(profile, /class="library-primary"/);
  assert.match(explore, /RANKING KAD · DEMONSTRAÇÃO/);
  assert.match(styles, /\.workspace-hero \{[^}]+min-height: 0/);
  assert.match(styles, /\.question-search-panel__primary/);
});

test('página pública usa navegação por seções, tema e acesso em janela', async () => {
  const [publicView, layout, main, styles] = await Promise.all([
    source('src/views/public.ts'),
    source('src/ui/layout.ts'),
    source('src/main.ts'),
    source('src/styles/app.css'),
  ]);

  for (const target of ['kad-how', 'kad-plans']) {
    assert.match(layout, new RegExp(`data-public-section-target="${target}"`));
    assert.match(publicView, new RegExp(`id="${target}"`));
  }
  for (const target of ['kad-about', 'kad-faq']) {
    assert.match(publicView, new RegExp(`id="${target}"`));
  }
  assert.doesNotMatch(publicView, /id="kad-tools"|id="kad-contests"/);
  assert.match(layout, /class="public-nav"/);
  assert.match(layout, /className: 'public-header__login'/);
  assert.doesNotMatch(layout, /button\('Entrar',[\s\S]+iconName: 'LogIn'/);
  assert.match(publicView, /data-public-auth-dialog/);
  assert.match(publicView, /data-public-auth-form="login"/);
  assert.match(publicView, /data-public-auth-form="signup"/);
  assert.match(publicView, /data-public-auth-visitor/);
  assert.match(layout, /data-action="toggle-theme"/);
  assert.match(main, /setupWelcomeNavigation/);
  assert.match(main, /visitorAccess\.hidden = mode !== 'login'/);
  assert.match(main, /aria-current', 'location'/);
  assert.match(styles, /\.public-shell--landing \.public-nav a/);
  assert.match(styles, /\.public-auth-dialog::backdrop/);
});

test('início interno adota composição editorial com navegação lateral preservada', async () => {
  const [home, layout, styles, metadata, main] = await Promise.all([
    source('src/views/home.ts'),
    source('src/ui/layout.ts'),
    source('src/styles/app.css'),
    source('src/services/metadata.ts'),
    source('src/main.ts'),
  ]);

  assert.match(layout, /<aside class="sidebar"/);
  assert.match(layout, /<main id="conteudo" class="page-content"/);
  assert.match(layout, /aria-label="Ativar tema \$\{dark \? 'claro' : 'escuro'\}"/);
  assert.match(home, /class="study-desk"/);
  assert.match(home, /studyNextAction/);
  assert.match(home, /class="study-plan"/);
  assert.match(home, /class="weekly-focus"/);
  assert.doesNotMatch(home, /class="hero-card"/);
  assert.doesNotMatch(home, /class="action-grid"/);
  assert.match(styles, /\.study-desk__continuity \{[^}]+grid-template-columns:/);
  assert.match(styles, /\.study-plan-row \{[^}]+border-bottom:/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]+\.study-plan-row \{ grid-template-columns:/);
  assert.match(metadata, /indexable = false/);
  assert.match(main, /source\.closest<HTMLAnchorElement>\('\.skip-link'\)/);
  assert.match(main, /document\.querySelector<HTMLElement>\(skipLink\.hash\)\?\.focus\(\)/);
});

test('áreas internas compartilham padrão editorial sem perder estruturas específicas', async () => {
  const [components, questions, simulations, explore, profile, styles] = await Promise.all([
    source('src/ui/components.ts'),
    source('src/views/questions.ts'),
    source('src/views/simulations.ts'),
    source('src/views/explore.ts'),
    source('src/views/profile.ts'),
    source('src/styles/app.css'),
  ]);
  const internalViews = `${questions}${simulations}${explore}${profile}`;

  assert.match(components, /export function workspaceHero/);
  assert.match(simulations, /workspaceHero\(/);
  assert.match(questions, /subjectIndexRow/);
  assert.match(explore, /timelineStep/);
  assert.match(profile, /settings-section/);
  assert.doesNotMatch(internalViews, /hero-card/);
  assert.match(questions, /class="question-search-panel"/);
  assert.match(questions, /<details class="filter-disclosure"/);
  assert.match(explore, /filter-panel--contest/);
  assert.match(profile, /filter-panel--short/);
  assert.doesNotMatch(questions, /class="sr-only" for="question-(keyword|discipline|board|status)"/);
  assert.doesNotMatch(explore, /class="sr-only" for="contest-(q|status|region)"/);
  assert.match(profile, /class="form-page"/);
  assert.match(styles, /\.app-shell \.card \{[^}]+box-shadow: none/);
  assert.match(styles, /\.workspace-hero \{[^}]+border-top: 3px solid var\(--primary\)/);
  assert.match(styles, /\.result-list \{[^}]+border-block:/);
});

test('linguagem visual do site prioriza neutros e mantém roxo como acento', async () => {
  const [styles, appStyles] = await Promise.all([
    source('src/styles/base.css'),
    source('src/styles/app.css'),
  ]);

  assert.match(styles, /--primary: #171717/);
  assert.match(styles, /--accent: #6d28d9/);
  assert.match(styles, /--accent-soft: #f1ebff/);
  assert.match(appStyles, /--kad-signal-yellow:\s*#/);
  assert.match(appStyles, /\.landing-hero__signal\s*\{/);
  assert.doesNotMatch(appStyles, /\.landing-hero__bolt|\.landing-hero__stamp|\.landing-note/);
});

test('PR 3 adiciona identidade roxa e energia amarela somente às áreas internas', async () => {
  const styles = await source('src/styles/app.css');

  assert.match(styles, /\.app-shell\s*\{[\s\S]*--primary:\s*#6d28d9/);
  assert.match(styles, /\.app-shell\s*\{[\s\S]*--energy:\s*#f6c800/);
  assert.match(styles, /:root\[data-theme='dark'\] \.app-shell\s*\{[\s\S]*--energy:\s*#ffd84a/);
  assert.match(styles, /\.app-shell \.nav-link\.is-active[\s\S]*inset 6px 0 0[^;]*var\(--energy\)/);
  assert.match(styles, /\.app-shell \.home-weekly \.progress__fill\s*\{[^}]*background:\s*var\(--energy\)/);
  assert.match(styles, /\.app-shell \.mobile-tabs \.nav-link--compact\.is-active/);
  assert.match(styles, /\.app-shell \.home-intro::before/);
  assert.match(styles, /\.app-shell \.workspace-hero::after/);
  assert.doesNotMatch(styles, /\.public-shell\s*\{[^}]*--energy:/);
  assert.match(styles, /\.app-shell--profile\s*\{[\s\S]*--primary:\s*#171717/);
});

test('PR 3.1 adiciona suporte semântico contido e mantém a exceção neutra do perfil', async () => {
  const styles = await source('src/styles/app.css');

  for (const token of ['info', 'success', 'warning', 'danger']) {
    assert.match(styles, new RegExp(`--color-support-${token}:\\s*#`));
    assert.match(styles, new RegExp(`--color-support-${token}-soft:\\s*#`));
    assert.match(styles, new RegExp(`--color-support-${token}-strong:\\s*#`));
  }
  assert.match(styles, /:root\[data-theme='dark'\] \.app-shell\s*\{[\s\S]*--color-support-info:/);
  assert.match(styles, /\.app-shell \.badge--success[\s\S]*var\(--color-support-success-soft\)/);
  assert.match(styles, /\.app-shell \.badge--warning[\s\S]*var\(--color-support-warning-soft\)/);
  assert.match(styles, /\.app-shell \.badge--danger[\s\S]*var\(--color-support-danger-soft\)/);
  assert.match(styles, /\.app-shell \.support-info/);
  assert.match(styles, /\.app-shell \.support-focus:focus-visible/);
  assert.match(styles, /\.app-shell--profile\s*\{[\s\S]*--primary:\s*#171717/);
  assert.doesNotMatch(styles, /\.public-shell \.badge--success[\s\S]*--color-support-success/);
});

test('build do site inclui o adaptador e o fallback exigidos pela hospedagem', async () => {
  const [packageJson, viteConfig, worker, wranglerConfig, hostingConfig, seoScript] = await Promise.all([
    source('package.json'),
    source('vite.config.ts'),
    source('server/index.ts'),
    source('wrangler.jsonc'),
    source('.openai/hosting.json'),
    source('scripts/postbuild-seo.ts'),
  ]);

  assert.match(packageJson, /@openai\/sites-vite-plugin/);
  assert.match(packageJson, /@cloudflare\/vite-plugin/);
  assert.match(viteConfig, /plugins: \[sites\(\), cloudflare\(/);
  assert.match(viteConfig, /viteEnvironment: \{ name: 'server' \}/);
  assert.match(worker, /env\.ASSETS\.fetch/);
  assert.match(worker, /new URL\('\/'/);
  assert.match(wranglerConfig, /"binding": "ASSETS"/);
  assert.match(wranglerConfig, /"not_found_handling": "single-page-application"/);
  assert.match(seoScript, /dist\/client\/index\.html/);
  assert.match(hostingConfig, /"project_id": "appgprj_[a-f0-9]+"/);
});
