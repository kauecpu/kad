import { badge, button, card, icon, passwordField } from '../ui/components.ts';
import { escapeHtml } from '../core/utils.ts';
import { getCatalog } from '../data/catalog.ts';
import type { SiteState, ViewModel } from '../types/domain.ts';

type AuthViewKind = 'entrar' | 'cadastro';
type RecoveryViewKind = 'request' | 'confirmation' | 'new-password';
type LegalViewKind = 'termos' | 'privacidade';

function publicAuthDialog(): string {
  return `
    <dialog class="public-auth-dialog" data-public-auth-dialog aria-labelledby="public-login-title">
      <div class="public-auth-dialog__topline">
        <a href="/" data-route="/" class="brand" aria-label="KAD Concursos — página inicial">
          <img src="/assets/kad-logo.png" alt="KAD Concursos" width="146" height="62" />
        </a>
        <button class="icon-button" type="button" data-action="close-public-auth" aria-label="Fechar janela de acesso">${icon('X')}</button>
      </div>
      <nav class="auth-mode-switch public-auth-dialog__switch" aria-label="Escolha como acessar">
        <button type="button" class="is-active" data-action="switch-public-auth" data-auth-mode="login" aria-pressed="true">Entrar</button>
        <button type="button" data-action="switch-public-auth" data-auth-mode="signup" aria-pressed="false">Criar conta</button>
      </nav>
      <form class="form-stack public-auth-form" data-form="login" data-public-auth-form="login" novalidate>
        <div class="auth-card__heading">
          <p class="eyebrow">BEM-VINDO DE VOLTA</p>
          <h2 id="public-login-title">Entrar na sua conta</h2>
          <p>Continue sua preparação de onde parou.</p>
        </div>
        <div class="field"><label for="public-login-email">E-mail</label><input class="input" id="public-login-email" name="email" type="email" autocomplete="email" required /></div>
        ${passwordField({ id: 'public-login-password', label: 'Senha', autocomplete: 'current-password' })}
        <a class="text-link public-auth-form__recovery" href="/recuperar-senha" data-route="/recuperar-senha">Esqueci minha senha</a>
        <p class="form-message" data-form-message aria-live="polite"></p>
        ${button('Entrar', { type: 'submit', size: 'lg', className: 'full-width' })}
      </form>
      <form class="form-stack public-auth-form" data-form="signup" data-public-auth-form="signup" novalidate hidden>
        <div class="auth-card__heading">
          <p class="eyebrow">COMECE SUA JORNADA</p>
          <h2 id="public-signup-title">Criar uma conta</h2>
          <p>Organize sua preparação e acompanhe cada avanço.</p>
        </div>
        <div class="field"><label for="public-signup-name">Nome completo</label><input class="input" id="public-signup-name" name="name" autocomplete="name" required /></div>
        <div class="field"><label for="public-signup-email">E-mail</label><input class="input" id="public-signup-email" name="email" type="email" autocomplete="email" required /></div>
        ${passwordField({ id: 'public-signup-password', label: 'Senha', autocomplete: 'new-password' })}
        ${passwordField({ id: 'public-signup-confirmation', label: 'Repetir senha', name: 'passwordConfirmation', autocomplete: 'new-password' })}
        <p class="form-message" data-form-message aria-live="polite"></p>
        ${button('Criar minha conta', { type: 'submit', size: 'lg', className: 'full-width' })}
      </form>
      <section class="public-auth-dialog__visitor" data-public-auth-visitor aria-labelledby="public-visitor-title">
        <div class="public-auth-dialog__visitor-heading">
          <h3 id="public-visitor-title">Modo visitante</h3>
          ${badge('Teste', 'warning')}
        </div>
        <p>Entre sem cadastro para testar o KAD. Seus dados ficarão salvos apenas neste navegador.</p>
        ${button('Acessar como visitante', { action: 'continue-visitor', variant: 'secondary', className: 'full-width' })}
      </section>
    </dialog>`;
}

export function welcomeView(): ViewModel {
  const catalog = getCatalog();
  const openContests = catalog.concursos.filter((contest) => contest.status !== 'encerrado');
  const featuredContests = (openContests.length ? openContests : catalog.concursos).slice(0, 3);
  const statusLabels = { aberto: 'Inscrições abertas', previsto: 'Previsto', encerrado: 'Encerrado' } as const;
  return {
    title: 'KAD Concursos',
    description: 'Questões, simulados e concursos reunidos em uma experiência de estudo feita para manter seu foco.',
    indexable: true,
    layout: 'public',
    content: `
      <section class="landing-hero" id="kad-top" aria-labelledby="welcome-title">
        <div class="landing-hero__inner">
          <div class="landing-hero__copy">
            <p class="eyebrow">SEU AMBIENTE DE PREPARAÇÃO</p>
            <h1 id="welcome-title">Mais clareza para chegar à sua próxima aprovação.</h1>
            <p class="landing-hero__lead">Questões, simulados, trilhas e concursos organizados para você estudar com direção, no seu ritmo e em qualquer tela.</p>
            <div class="landing-hero__actions">
              <a class="button button--primary button--lg" href="#kad-about"><span>Conhecer o KAD</span>${icon('ArrowDown')}</a>
              <a class="button button--secondary button--lg" href="#kad-tools"><span>Ver ferramentas</span></a>
            </div>
            <div class="landing-hero__proof" aria-label="Características do KAD">
              <span>${icon('CheckCircle2')} Questões comentadas</span>
              <span>${icon('CheckCircle2')} Progresso organizado</span>
              <span>${icon('CheckCircle2')} Acesso no computador e celular</span>
            </div>
          </div>
          <div class="landing-hero__visual" aria-hidden="true">
            <span class="landing-hero__orbit landing-hero__orbit--outer"></span>
            <span class="landing-hero__orbit landing-hero__orbit--inner"></span>
            <img src="/assets/kad-mascot-goal.png" alt="" width="620" height="620" />
            <span class="landing-note landing-note--focus">${icon('Target')}<span><small>Foco de hoje</small>Praticar com direção</span></span>
            <span class="landing-note landing-note--rhythm">${icon('BookOpenCheck')}<span><small>Seu ritmo</small>Um passo de cada vez</span></span>
          </div>
        </div>
      </section>

      <section class="landing-section landing-section--surface" id="kad-about" aria-labelledby="kad-about-title">
        <div class="landing-section__inner">
          <div class="landing-section__heading"><p class="eyebrow">O KAD</p><h2 id="kad-about-title">Um ambiente de estudos que organiza o caminho, não só o conteúdo.</h2></div>
          <div class="landing-about">
            <div class="landing-about__copy">
              <p>O KAD foi pensado para quem estuda para concursos e precisa transformar muitas possibilidades em uma rotina possível. Em vez de espalhar questões, metas e revisões por várias ferramentas, o ambiente reúne cada etapa da preparação em um fluxo mais claro.</p>
              <p>Você escolhe onde quer chegar, pratica com contexto e acompanha o que merece atenção. O mascote apoia a jornada; a informação e a próxima ação continuam no centro da experiência.</p>
            </div>
            <div class="landing-benefits" aria-label="Por que estudar pelo KAD">
              <article>${icon('Route')}<h3>Direção</h3><p>Metas e próximos passos visíveis.</p></article>
              <article>${icon('Layers3')}<h3>Organização</h3><p>Preparação reunida em um só ambiente.</p></article>
              <article>${icon('ChartNoAxesCombined')}<h3>Evolução</h3><p>Histórico que ajuda a decidir o foco.</p></article>
            </div>
          </div>
        </div>
      </section>

      <section class="landing-section" id="kad-how" aria-labelledby="kad-how-title">
        <div class="landing-section__inner">
          <div class="landing-section__heading"><p class="eyebrow">COMO FUNCIONA</p><h2 id="kad-how-title">Da meta à prática, sem perder o próximo passo.</h2></div>
          <div class="landing-how">
            <ol class="landing-steps">
              <li><span>01</span><div><h3>Defina sua direção</h3><p>Escolha um cargo, área ou concurso para organizar sua preparação.</p></div></li>
              <li><span>02</span><div><h3>Pratique com contexto</h3><p>Resolva questões, monte simulados e retome os pontos que pedem atenção.</p></div></li>
              <li><span>03</span><div><h3>Acompanhe sua evolução</h3><p>Use seu histórico real para decidir com mais clareza o que estudar depois.</p></div></li>
            </ol>
            <div class="landing-moments">
              <h3>Para cada momento da preparação</h3>
              <div>
                <article><strong>Começando agora</strong><p>Escolha uma meta e organize as matérias essenciais.</p></article>
                <article><strong>Pré-edital</strong><p>Construa constância com questões, trilhas e revisões.</p></article>
                <article><strong>Reta final</strong><p>Treine tempo de prova e retome erros com simulados.</p></article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="landing-section landing-section--surface" id="kad-tools" aria-labelledby="kad-tools-title">
        <div class="landing-section__inner">
          <div class="landing-section__heading"><p class="eyebrow">FERRAMENTAS</p><h2 id="kad-tools-title">Tudo que sustenta uma preparação consistente.</h2></div>
          <div class="landing-tools">
            <article>${icon('BookOpen')}<div><h3>Questões</h3><p>Prática por disciplina, banca e concurso, com gabarito no mesmo fluxo.</p></div></article>
            <article>${icon('Timer')}<div><h3>Simulados</h3><p>Sessões objetivas para treinar conteúdo, estratégia e tempo de prova.</p></div></article>
            <article>${icon('Compass')}<div><h3>Trilhas</h3><p>Metas e caminhos organizados para reduzir a dúvida sobre o próximo passo.</p></div></article>
            <article>${icon('PenLine')}<div><h3>Redação e biblioteca</h3><p>Espaço para escrever, revisar e manter seu repertório por perto.</p></div></article>
            <article>${icon('ChartNoAxesCombined')}<div><h3>Desempenho</h3><p>Progresso por disciplina para orientar suas próximas sessões.</p></div></article>
            <article>${icon('RotateCcw')}<div><h3>Revisão de erros</h3><p>Retome questões erradas e favoritas sem perder o histórico.</p></div></article>
          </div>
        </div>
      </section>

      <section class="landing-section" id="kad-contests" aria-labelledby="kad-contests-title">
        <div class="landing-section__inner">
          <div class="landing-section__heading"><p class="eyebrow">CONCURSOS</p><h2 id="kad-contests-title">Encontre uma direção antes de abrir o edital.</h2><p>Reconheça rapidamente áreas, bancas e níveis de escolaridade presentes no catálogo.</p></div>
          <div class="landing-contests">
            ${featuredContests.map((contest) => `<article>
              <div class="landing-contest__meta">${badge(statusLabels[contest.status], contest.status === 'aberto' ? 'accent' : 'warning')}<small>${escapeHtml(contest.board)} · ${escapeHtml(contest.levels.join(' e '))}</small></div>
              <h3>${escapeHtml(contest.shortName)}</h3><p>${escapeHtml(contest.title)}</p>
              ${button('Preparar para este concurso', { action: 'open-public-auth', variant: 'ghost', iconName: 'ArrowRight', attrs: 'data-auth-mode="signup"' })}
            </article>`).join('')}
          </div>
        </div>
      </section>

      <section class="landing-section landing-section--surface" id="kad-plans" aria-labelledby="kad-plans-title">
        <div class="landing-section__inner">
          <div class="landing-section__heading"><p class="eyebrow">PLANOS</p><h2 id="kad-plans-title">Comece pelo essencial e avance quando fizer sentido.</h2><p>Condições claras, com os principais benefícios visíveis antes do cadastro.</p></div>
          <div class="landing-plans">
            <article><div><h3>Básico</h3><p class="landing-plan__price">Grátis</p></div><ul><li>Questões ilimitadas</li><li>Correção e gabarito comentado</li></ul>${button('Criar conta', { action: 'open-public-auth', variant: 'secondary', attrs: 'data-auth-mode="signup"' })}</article>
            <article><div><h3>Diamond mensal</h3><p class="landing-plan__price">R$ 14,99 <small>/mês</small></p></div><ul><li>Simulados personalizados</li><li>Desempenho por disciplina</li><li>Revisão de erros e favoritas</li></ul>${button('Escolher mensal', { action: 'open-public-auth', variant: 'secondary', attrs: 'data-auth-mode="signup"' })}</article>
            <article class="landing-plan--featured"><span class="landing-plan__label">Recomendado</span><div><h3>Diamond trimestral</h3><p class="landing-plan__price">R$ 39,99 <small>/3 meses</small></p></div><ul><li>Tudo do Diamond</li><li>Economia de 11%</li><li>Cancele quando quiser</li></ul>${button('Escolher trimestral', { action: 'open-public-auth', attrs: 'data-auth-mode="signup"' })}</article>
            <article><div><h3>Diamond anual</h3><p class="landing-plan__price">R$ 149,99 <small>/ano</small></p></div><ul><li>Tudo do Diamond</li><li>Economia de 17%</li><li>Cancele quando quiser</li></ul>${button('Escolher anual', { action: 'open-public-auth', variant: 'secondary', attrs: 'data-auth-mode="signup"' })}</article>
          </div>
        </div>
      </section>

      <section class="landing-section landing-faq" id="kad-faq" aria-labelledby="kad-faq-title">
        <div class="landing-section__inner">
          <div class="landing-section__heading"><p class="eyebrow">DÚVIDAS</p><h2 id="kad-faq-title">Antes de começar.</h2></div>
          <div class="landing-faq__list">
            <details open><summary>Como começo a estudar pelo KAD?</summary><p>Crie sua conta, escolha uma meta e use as ferramentas para montar uma rotina alinhada ao concurso desejado.</p></details>
            <details><summary>Onde faço meu acesso?</summary><p>Use o botão “Entrar” no topo. Ele abre uma janela simples sem tirar você desta página.</p></details>
            <details><summary>E se eu ainda não tiver cadastro?</summary><p>Na própria janela de acesso, escolha “Criar conta” para começar.</p></details>
            <details><summary>Como escolho um plano?</summary><p>O plano Básico reúne questões e correção comentada. Os planos Diamond acrescentam simulados personalizados, desempenho e revisão de erros.</p></details>
          </div>
        </div>
      </section>

      <section class="landing-final" aria-labelledby="landing-final-title"><div><p class="eyebrow">QUANDO ESTIVER PRONTO</p><h2 id="landing-final-title">Seu próximo passo pode começar por uma questão.</h2></div>${button('Criar minha conta', { action: 'open-public-auth', size: 'lg', attrs: 'data-auth-mode="signup"' })}</section>
      <footer class="landing-footer"><span>KAD Concursos</span><nav aria-label="Documentos"><a href="/termos" data-route="/termos">Termos</a><a href="/privacidade" data-route="/privacidade">Privacidade</a></nav><span>Estudo com direção.</span></footer>
      ${publicAuthDialog()}`,
  };
}

const authCopy = {
  entrar: {
    title: 'Entrar',
    description: 'Continue de onde parou em qualquer dispositivo.',
    form: 'login',
    submit: 'Entrar',
  },
  cadastro: {
    title: 'Criar conta',
    description: 'Organize sua preparação e acompanhe cada avanço.',
    form: 'signup',
    submit: 'Criar minha conta',
  },
};

const authStories = [
  {
    eyebrow: 'PRÁTICA COM DIREÇÃO',
    title: 'Transforme questões em um plano de estudo.',
    description: 'Resolva, confira o gabarito e retome seus pontos de atenção sem perder o contexto da sessão.',
    image: 'kad-mascot-practice.png',
    highlights: [['ClipboardCheck', 'Gabarito no mesmo fluxo'], ['Bookmark', 'Favoritos para revisar']],
  },
  {
    eyebrow: 'SIMULADOS',
    title: 'Treine conteúdo, estratégia e tempo de prova.',
    description: 'Monte sessões objetivas, acompanhe o relógio e revise o resultado quando terminar.',
    image: 'kad-mascot-simulation.png',
    highlights: [['Timer', 'Tempo sob controle'], ['ListChecks', 'Revisão por questão']],
  },
  {
    eyebrow: 'REDAÇÃO E REPERTÓRIO',
    title: 'Escreva com foco e preserve cada versão.',
    description: 'Organize propostas, rascunhos e referências no mesmo ambiente usado para estudar as disciplinas.',
    image: 'kad-mascot-writing.png',
    highlights: [['PenLine', 'Editor focado'], ['Library', 'Biblioteca de apoio']],
  },
  {
    eyebrow: 'TRILHAS E CONCURSOS',
    title: 'Tenha clareza sobre o próximo passo.',
    description: 'Escolha uma meta e encontre questões, trilhas e concursos organizados para a sua preparação.',
    image: 'kad-mascot-goal.png',
    highlights: [['Compass', 'Trilhas organizadas'], ['Target', 'Meta sempre visível']],
  },
];

function authShowcase(): string {
  return `
    <aside class="auth-story" data-auth-carousel aria-label="Conheça o ambiente de estudos KAD" aria-roledescription="carrossel">
      <div class="auth-story__slides">
        ${authStories.map((story, index) => `
          <article class="auth-story__slide auth-story__slide--${index + 1} ${index === 0 ? 'is-active' : ''}" data-auth-slide="${index}" data-slide-title="${story.title}" aria-hidden="${index === 0 ? 'false' : 'true'}">
            <div class="auth-story__copy">
              <p class="eyebrow">${story.eyebrow}</p>
              <h2>${story.title}</h2>
              <p>${story.description}</p>
              <div class="auth-story__highlights" aria-label="Recursos relacionados">
                ${story.highlights.map(([iconName, label]) => `<span>${icon(iconName)} ${label}</span>`).join('')}
              </div>
            </div>
            <div class="auth-story__art" aria-hidden="true">
              <span class="auth-story__orbit"></span>
              <img src="/assets/${story.image}" alt="" width="520" height="520" />
            </div>
          </article>`).join('')}
      </div>
      <div class="auth-story__controls">
        <div class="auth-story__dots" role="group" aria-label="Escolher destaque do KAD">
          ${authStories.map((story, index) => `<button class="auth-story__dot ${index === 0 ? 'is-active' : ''}" type="button" data-action="select-auth-story" data-slide-index="${index}" aria-label="Mostrar destaque ${index + 1}: ${story.title}" aria-pressed="${index === 0 ? 'true' : 'false'}"><span></span></button>`).join('')}
        </div>
        <div class="auth-story__buttons" role="group" aria-label="Controles do destaque">
          <button class="auth-story__control" type="button" data-action="previous-auth-story" aria-label="Destaque anterior">${icon('ArrowLeft')}</button>
          <button class="auth-story__control auth-story__pause" type="button" data-action="pause-auth-story" aria-label="Pausar rotação" aria-pressed="false">${icon('Pause')}</button>
          <button class="auth-story__control" type="button" data-action="next-auth-story" aria-label="Próximo destaque">${icon('ChevronRight')}</button>
        </div>
      </div>
      <p class="sr-only" data-auth-carousel-status aria-live="polite"></p>
    </aside>`;
}

export function authView(kind: AuthViewKind = 'entrar'): ViewModel {
  const copy = authCopy[kind] ?? authCopy.entrar;
  const signup = kind === 'cadastro';
  return {
    title: copy.title,
    description: copy.description,
    layout: 'public-simple',
    content: `
      <section class="auth-page auth-page--split">
        ${authShowcase()}
        ${card(`
          <nav class="auth-mode-switch" aria-label="Escolha como acessar">
            <a href="/entrar" data-route="/entrar" class="${signup ? '' : 'is-active'}" ${signup ? '' : 'aria-current="page"'}>Entrar</a>
            <a href="/cadastro" data-route="/cadastro" class="${signup ? 'is-active' : ''}" ${signup ? 'aria-current="page"' : ''}>Criar conta</a>
          </nav>
          <div class="auth-card__heading">
            <h1>${copy.title}</h1>
            <p>${copy.description}</p>
          </div>
          <form class="form-stack auth-form" data-form="${copy.form}" novalidate>
            ${signup ? `<div class="field"><label for="name">Nome completo</label><input class="input" id="name" name="name" autocomplete="name" required /></div>` : ''}
            <div class="field"><label for="email">E-mail</label><input class="input" id="email" name="email" type="email" autocomplete="email" required /></div>
            ${passwordField({ id: 'password', label: 'Senha', autocomplete: signup ? 'new-password' : 'current-password' })}
            ${signup ? passwordField({ id: 'password-confirmation', label: 'Repetir senha', name: 'passwordConfirmation', autocomplete: 'new-password' }) : `<a class="text-link auth-form__recovery" href="/recuperar-senha" data-route="/recuperar-senha">Esqueci minha senha</a>`}
            <p class="form-message" data-form-message aria-live="polite"></p>
            ${button(copy.submit, { type: 'submit', size: 'lg', className: 'full-width' })}
          </form>
        `, 'auth-card auth-card--portal')}
      </section>`,
  };
}

export function recoveryView(kind: RecoveryViewKind = 'request', params: Record<string, string | undefined> = {}): ViewModel {
  const isNewPassword = kind === 'new-password';
  const isConfirmation = kind === 'confirmation';
  const title = isNewPassword ? 'Nova senha' : isConfirmation ? 'Confirmar e-mail' : 'Recuperar senha';
  const description = isNewPassword
    ? 'Defina uma nova senha segura para sua conta.'
    : isConfirmation
      ? 'Use o código enviado para concluir seu cadastro.'
      : 'Enviaremos as instruções para o endereço cadastrado.';
  const formName = isNewPassword ? 'new-password' : isConfirmation ? 'confirmation' : 'recovery';
  if (isNewPassword && params.recoveryStatus !== 'ready') {
    const checking = params.recoveryStatus === 'checking';
    return {
      title,
      description,
      layout: 'public-simple',
      content: `<section class="auth-page">${card(`<div class="auth-card__heading"><p class="eyebrow">SEGURANÇA</p><h1>${checking ? 'Validando link' : 'Link inválido'}</h1><p>${checking ? 'Aguarde enquanto confirmamos esta recuperação neste navegador.' : 'Solicite um novo e-mail de recuperação para definir sua senha.'}</p></div>${checking ? '' : button('Solicitar novo link', { route: '/recuperar-senha', size: 'lg', className: 'full-width' })}`, 'auth-card')}</section>`,
    };
  }
  return {
    title,
    description,
    layout: 'public-simple',
    content: `<section class="auth-page">${card(`
      <div class="auth-card__heading"><p class="eyebrow">SEGURANÇA</p><h1>${title}</h1><p>${description}</p></div>
      <form class="form-stack" data-form="${formName}">
        ${isNewPassword ? `
          ${passwordField({ id: 'new-password', label: 'Nova senha', autocomplete: 'new-password' })}
          ${passwordField({ id: 'new-password-confirmation', label: 'Confirmar nova senha', name: 'passwordConfirmation', autocomplete: 'new-password' })}
        ` : `
          <div class="field"><label for="recovery-email">E-mail</label><input class="input" id="recovery-email" name="email" type="email" autocomplete="email" value="${escapeHtml(params.email ?? '')}" required /></div>
          ${isConfirmation ? `<div class="field"><label for="confirmation-code">Código de 6 dígitos</label><input class="input" id="confirmation-code" name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required /></div>` : ''}
        `}
        <p class="form-message" data-form-message></p>
        ${button(isNewPassword ? 'Salvar nova senha' : isConfirmation ? 'Confirmar código' : 'Enviar instruções', { type: 'submit', size: 'lg', className: 'full-width' })}
        ${isConfirmation ? button('Reenviar código', { action: 'resend-confirmation', variant: 'ghost', className: 'full-width' }) : ''}
      </form>
      <p class="auth-footer"><a href="/entrar" data-route="/entrar">Voltar para entrar</a></p>
    `, 'auth-card')}</section>`,
  };
}

export function onboardingView(state: SiteState): ViewModel {
  return {
    title: 'Escolha sua meta',
    description: 'Personalize as recomendações do seu ambiente de estudos.',
    layout: 'public-simple',
    content: `<section class="auth-page">${card(`
      <div class="auth-card__heading">
        <p class="eyebrow">PRIMEIRO PASSO</p>
        <h1>Qual é a sua próxima aprovação?</h1>
        <p>Essa escolha organiza concursos, simulados, trilhas e temas de redação para você.</p>
      </div>
      <form class="form-stack" data-form="onboarding">
        <div class="field"><label for="target-role">Cargo, área ou concurso</label><input class="input" id="target-role" name="targetRole" value="${escapeHtml(state.profile.targetRole)}" placeholder="Ex.: Técnico Judiciário, INSS, Área Fiscal" /></div>
        <div class="field"><label for="weekly-goal">Meta semanal de questões</label><select class="select" id="weekly-goal" name="weeklyGoal">${[15, 30, 50, 75, 100].map((value) => `<option value="${value}" ${state.preferences.weeklyGoal === value ? 'selected' : ''}>${value} questões</option>`).join('')}</select></div>
        ${button('Abrir meu KAD', { type: 'submit', iconName: 'Target', size: 'lg', className: 'full-width' })}
        <button type="button" class="button button--ghost" data-action="skip-onboarding">Ainda estou explorando</button>
      </form>
    `, 'auth-card')}</section>`,
  };
}

const legalDocuments = {
  termos: {
    title: 'Termos de Uso',
    updated: 'Atualizado em agosto de 2026',
    sections: [
      ['Uso do KAD', 'O KAD oferece recursos de preparação para concursos. O acesso deve ser usado de forma lícita, pessoal e compatível com estes termos.'],
      ['Conteúdo educacional', 'Questões, explicações e indicadores apoiam o estudo, mas não garantem aprovação nem substituem a consulta aos editais e fontes oficiais.'],
      ['Conta e segurança', 'Você é responsável por manter seus dados de acesso protegidos e por informar atividades suspeitas.'],
      ['Planos e pagamentos', 'Recursos pagos, quando ativados, apresentam preço, periodicidade e condições antes da confirmação da compra.'],
      ['Disponibilidade', 'Podemos atualizar recursos para melhorar segurança, desempenho e qualidade da experiência. Mudanças relevantes serão comunicadas pelos canais adequados.'],
    ],
  },
  privacidade: {
    title: 'Política de Privacidade',
    updated: 'Atualizada em agosto de 2026',
    sections: [
      ['Dados utilizados', 'Usamos dados de conta, preferências e atividade de estudo necessários para autenticação, sincronização, personalização e melhoria do serviço.'],
      ['Armazenamento local', 'No modo visitante, respostas, favoritos, redações e preferências ficam neste navegador e podem ser apagados no perfil.'],
      ['Proteção', 'Aplicamos controles técnicos e evitamos expor credenciais administrativas nos clientes. Chaves públicas não substituem políticas de acesso no servidor.'],
      ['Seus direitos', 'Você pode corrigir seus dados, solicitar exclusão da conta e limpar os dados armazenados neste dispositivo.'],
      ['Contato', 'O formulário “Fale com o KAD” pode ser usado para dúvidas sobre privacidade e funcionamento da plataforma.'],
    ],
  },
};

export function legalView(kind: LegalViewKind): ViewModel {
  const document = legalDocuments[kind] ?? legalDocuments.termos;
  return {
    title: document.title,
    description: `${document.title} do ambiente de estudos KAD Concursos.`,
    indexable: true,
    layout: 'public-simple',
    content: `<section class="auth-page"><div class="legal-content">${card(`
      <div class="auth-card__heading"><p class="eyebrow">KAD CONCURSOS</p><h1>${document.title}</h1><p>${document.updated}</p></div>
      ${document.sections.map(([title, text]) => `<section><h2>${title}</h2><p>${text}</p></section>`).join('')}
      ${button('Voltar', { action: 'back', variant: 'secondary' })}
    `, 'legal-document')}</div></section>`,
  };
}
