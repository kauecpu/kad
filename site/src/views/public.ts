import { badge, button, card, icon, passwordField } from '../ui/components.ts';
import { kadSignalMark } from '../ui/brand.ts';
import { escapeHtml } from '../core/utils.ts';
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
  return {
    title: 'KAD Concursos',
    description: 'Questões, simulados e concursos reunidos em uma experiência de estudo feita para manter seu foco.',
    indexable: true,
    layout: 'public',
    content: `
      <div class="landing" aria-label="KAD Concursos">
        <section class="landing-hero" id="kad-top" aria-labelledby="welcome-title">
          <div class="landing-hero__copy">
            <p class="eyebrow">KAD CONCURSOS · PREPARAÇÃO COM DIREÇÃO</p>
            <h1 id="welcome-title">Estude o que importa.<br /><span>Avance com direção.</span></h1>
            <p class="landing-hero__lead">Questões e simulados organizados para você estudar com direção.</p>
            <div class="landing-hero__actions">
              ${button('Começar agora', { action: 'open-public-auth', size: 'lg', attrs: 'data-auth-mode="signup"' })}
              <a class="button button--secondary button--lg" href="#kad-about">Conhecer o KAD</a>
            </div>
            <div class="landing-hero__proof" aria-label="O que você encontra no KAD">
              <span>Questões por foco</span><span>Gabarito que ensina</span><span>Ritmo possível</span>
            </div>
          </div>
          <aside class="landing-hero__panel" aria-label="O essencial do KAD">
            <div class="landing-hero__panel-head"><h2>O essencial, em um só lugar</h2><div class="landing-hero__lightning" aria-hidden="true">${kadSignalMark({ className: 'kad-signal--compact' })}</div></div>
            <div class="landing-hero__features">
              <div><strong>Questões</strong><span>Prática por disciplina, banca e cargo.</span></div>
              <div><strong>Simulados</strong><span>Treino com tempo e estratégia de prova.</span></div>
              <div><strong>Trilhas</strong><span>Um próximo passo claro para cada sessão.</span></div>
            </div>
          </aside>
        </section>

        <section class="landing-section landing-about" id="kad-about" aria-labelledby="about-title">
          <header class="landing-section__heading"><p class="eyebrow">O KAD</p><h2 id="about-title">Estudo com direção,<br />não com excesso.</h2><p>O KAD reúne o essencial para você saber o que estudar agora.</p></header>
          <div class="landing-about__principles">
            <article><span>01</span><div><h3>Direção</h3><p>Foque no que mais importa para sua prova.</p></div></article>
            <article><span>02</span><div><h3>Organização</h3><p>Questões, simulados e revisões no mesmo caminho.</p></div></article>
            <article><span>03</span><div><h3>Evolução</h3><p>Acompanhe seu ritmo e ajuste a próxima sessão.</p></div></article>
          </div>
        </section>

        <section class="landing-section landing-steps" id="kad-how" aria-labelledby="steps-title">
          <header class="landing-section__heading"><p class="eyebrow">COMO FUNCIONA</p><h2 id="steps-title">Três passos para sair da intenção e praticar.</h2></header>
          <div class="landing-steps__grid">
            <article><span>01</span><h3>Escolha seu objetivo</h3><p>Defina o concurso ou carreira que guia seus estudos.</p></article>
            <article><span>02</span><h3>Pratique com contexto</h3><p>Resolva questões e simulados com foco no edital.</p></article>
            <article><span>03</span><h3>Veja sua evolução</h3><p>Use seu histórico para decidir o próximo passo.</p></article>
          </div>
        </section>

        <section class="landing-section landing-plans" id="kad-plans" aria-labelledby="plans-title">
          <header class="landing-section__heading landing-section__heading--center"><p class="eyebrow">PLANOS</p><h2 id="plans-title">Comece pelo essencial.</h2><p>Planos claros para o seu ritmo.</p></header>
          <div class="landing-plans__grid">
            <article><p class="landing-plan__name">BÁSICO</p><strong>Grátis</strong><ul><li>Questões ilimitadas</li><li>Correção e gabarito comentado</li></ul>${button('Começar agora', { action: 'open-public-auth', variant: 'secondary', className: 'landing-plan__button', attrs: 'data-auth-mode="signup"' })}</article>
            <article><p class="landing-plan__name">DIAMOND MENSAL</p><strong>R$ 14,99<small>/mês</small></strong><ul><li>Simulados personalizados</li><li>Desempenho por disciplina</li><li>Revisão de erros e favoritas</li></ul>${button('Assinar mensal', { action: 'open-public-auth', variant: 'secondary', className: 'landing-plan__button', attrs: 'data-auth-mode="signup"' })}</article>
            <article class="landing-plan--featured"><p class="landing-plan__name">DIAMOND ANUAL <em>RECOMENDADO</em></p><strong>R$ 149,99<small>/ano</small></strong><ul><li>Todos os benefícios do Diamond</li><li>Acesso por 12 meses</li><li>Melhores condições</li></ul>${button('Garantir plano anual', { action: 'open-public-auth', className: 'landing-plan__button', attrs: 'data-auth-mode="signup"' })}</article>
          </div>
        </section>

        <section class="landing-section landing-faq" id="kad-faq" aria-labelledby="faq-title">
          <header class="landing-section__heading"><p class="eyebrow">DÚVIDAS</p><h2 id="faq-title">Antes de começar.</h2></header>
          <div class="landing-faq__list">
            <details><summary>Como começo a estudar pelo KAD?${icon('Plus')}</summary><p>Crie sua conta, escolha uma meta e deixe o KAD organizar o próximo passo.</p></details>
            <details><summary>Onde faço meu acesso?${icon('Plus')}</summary><p>Use o botão “Entrar” no topo para continuar de onde parou.</p></details>
            <details><summary>Como escolho um plano?${icon('Plus')}</summary><p>Comece no plano Básico e avance quando fizer sentido.</p></details>
          </div>
        </section>

        <footer class="landing-footer"><div><h2>Comece por uma questão.</h2>${button('Criar minha conta', { action: 'open-public-auth', attrs: 'data-auth-mode="signup"' })}</div><div><strong>KAD Concursos</strong><a href="/termos" data-route="/termos">Termos de Uso</a><a href="/privacidade" data-route="/privacidade">Privacidade</a><em>Estude com direção.</em></div></footer>
      </div>
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
    highlights: [['ClipboardCheck', 'Gabarito no mesmo fluxo'], ['Bookmark', 'Favoritos para revisar']],
  },
  {
    eyebrow: 'SIMULADOS',
    title: 'Treine conteúdo, estratégia e tempo de prova.',
    description: 'Monte sessões objetivas, acompanhe o relógio e revise o resultado quando terminar.',
    highlights: [['Timer', 'Tempo sob controle'], ['ListChecks', 'Revisão por questão']],
  },
  {
    eyebrow: 'REDAÇÃO E REPERTÓRIO',
    title: 'Escreva com foco e preserve cada versão.',
    description: 'Organize propostas, rascunhos e referências no mesmo ambiente usado para estudar as disciplinas.',
    highlights: [['PenLine', 'Editor focado'], ['Library', 'Biblioteca de apoio']],
  },
  {
    eyebrow: 'TRILHAS E CONCURSOS',
    title: 'Tenha clareza sobre o próximo passo.',
    description: 'Escolha uma meta e encontre questões, trilhas e concursos organizados para a sua preparação.',
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
