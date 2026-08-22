import { badge, button, card, icon } from '../ui/components.js';
import { escapeHtml } from '../core/utils.js';

export function welcomeView() {
  return {
    title: 'KAD Concursos',
    description: 'Questões, simulados e concursos reunidos em uma experiência de estudo feita para manter seu foco.',
    indexable: true,
    layout: 'public',
    content: `
      <section class="welcome" aria-labelledby="welcome-title">
        <div class="welcome__copy">
          ${badge('Seu ambiente de preparação', 'accent', 'Sparkles')}
          <h1 id="welcome-title">Estude com <span>direção.</span></h1>
          <p class="welcome__lead">Questões comentadas, simulados, trilhas e concursos organizados para transformar constância em aprovação — agora também no computador.</p>
          <div class="welcome__actions">
            ${button('Estudar como visitante', { action: 'continue-visitor', iconName: 'Play', size: 'lg' })}
            ${button('Entrar na minha conta', { route: '/entrar', variant: 'secondary', size: 'lg' })}
          </div>
          <div class="welcome__proof" aria-label="Recursos do KAD">
            <span>${icon('CheckCircle2')} Questões ilimitadas</span>
            <span>${icon('CheckCircle2')} Progresso salvo neste navegador</span>
            <span>${icon('CheckCircle2')} Feito para qualquer tela</span>
          </div>
        </div>
        <div class="welcome__visual" aria-hidden="true">
          <div class="welcome__halo"></div>
          <img class="welcome__mascot" src="/assets/kad-mascot-goal.png" alt="" width="620" height="620" />
        </div>
      </section>`,
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

export function authView(kind = 'entrar') {
  const copy = authCopy[kind] ?? authCopy.entrar;
  const signup = kind === 'cadastro';
  return {
    title: copy.title,
    description: copy.description,
    layout: 'public-simple',
    content: `
      <section class="auth-page">
        ${card(`
          <div class="auth-card__heading">
            <p class="eyebrow">CONTA KAD</p>
            <h1>${copy.title}</h1>
            <p>${copy.description}</p>
          </div>
          <form class="form-stack" data-form="${copy.form}" novalidate>
            ${signup ? `<div class="field"><label for="name">Nome completo</label><input class="input" id="name" name="name" autocomplete="name" required /></div>` : ''}
            <div class="field"><label for="email">E-mail</label><input class="input" id="email" name="email" type="email" autocomplete="email" required /></div>
            <div class="field"><label for="password">Senha</label><input class="input" id="password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required /></div>
            ${signup ? `<div class="field"><label for="password-confirmation">Repetir senha</label><input class="input" id="password-confirmation" name="passwordConfirmation" type="password" autocomplete="new-password" minlength="8" required /></div>` : `<a class="text-link" href="/recuperar-senha" data-route="/recuperar-senha">Esqueci minha senha</a>`}
            <p class="form-message" data-form-message>Se o Supabase ainda não estiver configurado, você poderá continuar no modo demonstrativo.</p>
            ${button(copy.submit, { type: 'submit', size: 'lg', className: 'full-width' })}
          </form>
          <p class="auth-footer">${signup ? 'Já possui conta?' : 'Ainda não possui conta?'} <a href="/${signup ? 'entrar' : 'cadastro'}" data-route="/${signup ? 'entrar' : 'cadastro'}">${signup ? 'Entrar' : 'Criar conta'}</a></p>
          <button class="button button--ghost" type="button" data-action="continue-visitor">Continuar como visitante</button>
        `, 'auth-card')}
      </section>`,
  };
}

export function recoveryView(kind = 'request', params = {}) {
  const isNewPassword = kind === 'new-password';
  const isConfirmation = kind === 'confirmation';
  const title = isNewPassword ? 'Nova senha' : isConfirmation ? 'Confirmar e-mail' : 'Recuperar senha';
  const description = isNewPassword
    ? 'Defina uma nova senha segura para sua conta.'
    : isConfirmation
      ? 'Use o código enviado para concluir seu cadastro.'
      : 'Enviaremos as instruções para o endereço cadastrado.';
  const formName = isNewPassword ? 'new-password' : isConfirmation ? 'confirmation' : 'recovery';
  return {
    title,
    description,
    layout: 'public-simple',
    content: `<section class="auth-page">${card(`
      <div class="auth-card__heading"><p class="eyebrow">SEGURANÇA</p><h1>${title}</h1><p>${description}</p></div>
      <form class="form-stack" data-form="${formName}">
        ${isNewPassword ? `
          <div class="field"><label for="new-password">Nova senha</label><input class="input" id="new-password" name="password" type="password" minlength="8" required /></div>
          <div class="field"><label for="new-password-confirmation">Confirmar nova senha</label><input class="input" id="new-password-confirmation" name="passwordConfirmation" type="password" minlength="8" required /></div>
        ` : `
          <div class="field"><label for="recovery-email">E-mail</label><input class="input" id="recovery-email" name="email" type="email" autocomplete="email" value="${escapeHtml(params.email ?? '')}" required /></div>
          ${isConfirmation ? `<div class="field"><label for="confirmation-code">Código de 6 dígitos</label><input class="input" id="confirmation-code" name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required /></div>` : ''}
        `}
        <p class="form-message" data-form-message></p>
        ${button(isNewPassword ? 'Salvar nova senha' : isConfirmation ? 'Confirmar código' : 'Enviar instruções', { type: 'submit', size: 'lg', className: 'full-width' })}
      </form>
      <p class="auth-footer"><a href="/entrar" data-route="/entrar">Voltar para entrar</a></p>
    `, 'auth-card')}</section>`,
  };
}

export function onboardingView(state) {
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

export function legalView(kind) {
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
