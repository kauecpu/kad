import { getCatalog } from '../data/catalog.ts';
import { escapeHtml, formatCount, formatPercent, formatTimer, groupPerformance, normalizeText, questionsPerformance } from '../core/utils.ts';
import { avatar, badge, button, card, emptyState, icon, metricRing, passwordField, progress, section, stat, workspaceHero } from '../ui/components.ts';
import { stackHeader } from '../ui/layout.ts';
import type { CheckoutProgress, SiteState, ViewModel } from '../types/domain.ts';
import type { LevelState } from '../../../contracts/level-tracker.ts';
import { LEVEL_MILESTONES, LEVEL_RULES, levelColor } from '../../../contracts/levels.ts';
import { checkoutFeedbackFor } from '../core/payment.ts';
import { subscriptionHasAccess, subscriptionPlanName } from '../core/subscription.ts';

type ViewParams = Record<string, string | undefined>;

export function essayView(state: SiteState, params: ViewParams = {}): ViewModel {
  const { essayTopics, packs } = getCatalog();
  const topic = essayTopics.find((item) => item.id === params.topic);
  const stage = params.stage ?? (topic ? 'write' : 'topics');
  if (topic && stage === 'review') {
    const draft = state.essays[topic.id] ?? { content: '', elapsedSeconds: 0 };
    const wordCount = draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0;
    return {
      title: 'Revisar redação',
      subtitle: topic.title,
      content: `
        ${stackHeader('Revisar prática', topic.title)}
        ${card(`<div class="result-hero"><div class="result-hero__copy"><p class="eyebrow">PRÁTICA CONCLUÍDA</p><h2>Agora, revise com intenção.</h2><p>Use os critérios da proposta para identificar pontos fortes e o que pode melhorar.</p></div>${metricRing(Math.min(100, (wordCount / 250) * 100), 'meta de palavras')}</div>`)}
        <div class="summary-grid">${card(stat(String(wordCount), 'Palavras', 'FileText'))}${card(stat(formatTimer(draft.elapsedSeconds), 'Tempo', 'Clock3'))}${card(stat(topic.difficulty, 'Nível', 'TrendingUp'))}${card(stat(topic.lineRange, 'Extensão sugerida', 'ListChecks'))}</div>
        ${section('Seu texto', card(`<div class="legal-document"><p style="white-space:pre-wrap">${escapeHtml(draft.content || 'Nenhum texto foi salvo.')}</p></div>`))}
        ${section('Roteiro de revisão', card(`<div class="detail-panel"><ul class="benefit-list">${topic.criteria.map((criterion) => `<li>${icon('CheckCircle2')}<span><strong>${escapeHtml(criterion)}</strong><br />Verifique se esse aspecto aparece de forma clara e consistente no texto.</span></li>`).join('')}</ul><div class="welcome__actions">${button('Voltar ao texto', { route: `/redacao?topic=${topic.id}&stage=write`, variant: 'secondary', iconName: 'PenLine' })}${button('Escolher outro tema', { route: '/redacao', variant: 'ghost' })}</div></div>`))}
      `,
    };
  }
  if (topic) {
    const draft = state.essays[topic.id] ?? { content: '', elapsedSeconds: 0 };
    const wordCount = draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0;
    return {
      title: 'Redação',
      subtitle: topic.title,
      content: `
        ${stackHeader('Prática de redação', topic.title)}
        <div class="toolbar"><div class="question-meta">${badge(topic.difficulty, 'accent')}${badge(`${topic.suggestedMinutes} min`, 'neutral', 'Clock3')}${badge(topic.lineRange)}</div><span class="badge badge--accent">${icon('Clock3')} <span data-essay-timer>${formatTimer(draft.elapsedSeconds)}</span></span></div>
        <div class="essay-layout">
          ${card(`<div class="essay-editor"><div class="toolbar"><p class="eyebrow">SUA REDAÇÃO</p><span class="muted" data-word-count>${formatCount(wordCount, 'palavra', 'palavras')}</span></div><label class="sr-only" for="essay-content">Texto da redação</label><textarea id="essay-content" class="textarea" data-essay-input data-topic-id="${topic.id}" placeholder="Comece a escrever aqui...">${escapeHtml(draft.content)}</textarea><div class="study-controls"><span class="muted">${state.auth.mode === 'authenticated' ? 'Rascunho sincronizado com sua conta KAD.' : 'Rascunho salvo neste navegador.'}</span>${button('Concluir prática', { route: `/redacao?topic=${topic.id}&stage=review`, iconName: 'CheckCircle2' })}</div></div>`)}
          <aside class="dashboard-aside">${card(`<div class="essay-prompt"><p class="eyebrow">PROPOSTA</p><h2>${escapeHtml(topic.title)}</h2><p>${escapeHtml(topic.context)}</p><hr class="divider" /><strong>Comando</strong><p>${escapeHtml(topic.command)}</p></div>`)}${card(`<div class="detail-panel"><p class="eyebrow">CRITÉRIOS</p><ul class="benefit-list">${topic.criteria.map((item) => `<li>${icon('Check')}${escapeHtml(item)}</li>`).join('')}</ul></div>`)}</aside>
        </div>`,
    };
  }

  const query = normalizeText(params.q);
  const topics = essayTopics.filter((item) => (!params.packId || item.packId === params.packId) && (!query || normalizeText(`${item.title} ${item.category}`).includes(query)));
  const recommended = essayTopics.find((item) => {
    const pack = packs.find((candidate) => candidate.id === item.packId);
    return state.profile.targetRole && normalizeText(`${pack?.name} ${pack?.goalKeywords.join(' ')}`).includes(normalizeText(state.profile.targetRole));
  }) ?? essayTopics[0];
  return {
    title: 'Redação',
    subtitle: 'Pratique no formato dos concursos',
    content: `
      ${workspaceHero({
        id: 'essay-overview',
        eyebrow: 'PRÁTICA GUIADA',
        title: 'Sua próxima redação começa aqui.',
        description: `${recommended.title}. Organize os argumentos, escreva no seu tempo e finalize com um roteiro de autorrevisão.`,
        actions: button('Começar tema recomendado', { route: `/redacao?topic=${recommended.id}&stage=write`, iconName: 'PenLine' }),
      })}
      <form class="filter-bar filter-panel filter-panel--short" data-form="essay-filter"><div class="field"><label for="essay-q">Buscar tema</label><input class="input" id="essay-q" name="q" value="${escapeHtml(params.q ?? '')}" placeholder="Tema ou categoria" /></div><div class="field"><label for="essay-pack">Concurso</label><select class="select" id="essay-pack" name="packId"><option value="">Todos os concursos</option>${packs.map((pack) => `<option value="${pack.id}" ${params.packId === pack.id ? 'selected' : ''}>${escapeHtml(pack.name)}</option>`).join('')}</select></div>${button('Filtrar', { type: 'submit', iconName: 'Filter' })}</form>
      ${section('Explorar temas', topics.length ? `<div class="topic-grid">${topics.map((item) => {
        const pack = packs.find((candidate) => candidate.id === item.packId);
        const hasDraft = Boolean(state.essays[item.id]?.content);
        return card(`<div class="question-meta">${badge(pack?.name ?? 'Concurso')}${badge(item.difficulty, 'accent')}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.category)} · ${item.suggestedMinutes} minutos · ${item.lineRange}</p>${button(hasDraft ? 'Continuar redação' : 'Começar redação', { route: `/redacao?topic=${item.id}&stage=write`, variant: hasDraft ? 'secondary' : 'primary', iconName: 'PenLine' })}`, 'topic-card');
      }).join('')}</div>` : emptyState('Nenhum tema encontrado', 'Tente retirar um filtro ou pesquisar outro assunto.'))}
    `,
  };
}

export function libraryView(): ViewModel {
  return {
    title: 'Biblioteca',
    subtitle: 'Conteúdo para revisar',
    content: `
      ${workspaceHero({
        id: 'library-overview',
        eyebrow: 'BIBLIOTECA KAD',
        title: 'Revise o que já está disponível.',
        description: 'Flashcards são o recurso ativo da biblioteca. Os demais formatos continuam identificados como etapas futuras.',
        actions: button('Abrir flashcards', { route: '/flashcards', iconName: 'Layers3' }),
      })}
      ${section('Disponível agora', `<button class="library-primary" type="button" data-route="/flashcards"><span class="library-primary__icon">${icon('Layers3')}</span><span><strong>Flashcards</strong><small>Crie baralhos e revise agora</small></span>${icon('ArrowRight')}</button>`, { eyebrow: 'REVISÃO ATIVA' })}
      <section class="notice-panel" aria-labelledby="library-status"><div class="notice-panel__heading"><span class="empty-state__icon">${icon('Library')}</span>${badge('Em construção', 'warning', 'Clock3')}</div><h2 id="library-status">Sua biblioteca cresce por etapas.</h2><p>Os flashcards já estão disponíveis e sincronizam com o aplicativo. Audiobooks e anotações serão conectados quando houver conteúdo correspondente no backend.</p></section>
      <div class="action-grid library-coming-soon"><div class="action-card"><span class="action-card__icon">${icon('Headphones')}</span><div><h3>Audiobooks</h3><p>Conteúdo ainda não publicado.</p></div></div><div class="action-card"><span class="action-card__icon">${icon('StickyNote')}</span><div><h3>Anotações</h3><p>Integração prevista para uma próxima etapa.</p></div></div></div>
    `,
  };
}

function levelModule(levelState: LevelState): string {
  const progress = levelState.progress;
  if (levelState.status === 'loading' && !progress) return `<section class="level-card level-card--status" aria-busy="true"><span class="level-spinner" aria-hidden="true"></span><p>Carregando seu nível…</p></section>`;
  if (!progress) return `<section class="level-card level-card--status" role="alert"><span class="level-status-icon">${icon('CloudOff')}</span><div><h2>Nível indisponível</h2><p>Seu progresso não foi substituído por zero. Tente sincronizar novamente.</p></div><button class="button button--secondary" type="button" data-action="retry-level">Tentar de novo</button></section>`;
  const milestone = LEVEL_MILESTONES.includes(progress.level as (typeof LEVEL_MILESTONES)[number]);
  const percent = Math.round(progress.ratio * 10000) / 100;
  const sync = levelState.status === 'unavailable'
    ? `<p class="level-sync level-sync--error" role="alert">Não foi possível atualizar agora. O último XP confirmado continua visível. <button type="button" data-action="retry-level">Tentar novamente</button></p>`
    : levelState.pending ? `<p class="level-sync" role="status">${formatCount(levelState.pending, 'atividade aguardando confirmação', 'atividades aguardando confirmação')}.</p>` : '';
  return `<section class="level-card" aria-labelledby="level-title">
    <div class="level-heading"><div class="level-ring${milestone ? ' is-milestone' : ''}" style="--level:${progress.level * 3.6}deg;--level-color:${levelColor(progress.level)}" role="img" aria-label="Nível ${progress.level} de 100"><strong>${progress.level}</strong></div><div><p class="level-eyebrow">SEU ESTUDO, ACUMULADO</p><h2 id="level-title">Nível ${progress.level} de 100</h2><p>Prática e constância. No seu ritmo.</p></div></div>
    <div class="level-xp"><strong>${progress.max ? `${progress.totalXp.toLocaleString('pt-BR')} XP acumulados` : `${progress.currentXp.toLocaleString('pt-BR')} / ${progress.nextCost.toLocaleString('pt-BR')} XP`}</strong><div class="level-progress" role="progressbar" aria-label="${progress.max ? 'Nível máximo alcançado' : `Progresso para o nível ${progress.level + 1}`}" aria-valuemin="0" aria-valuemax="${progress.max ? 100 : progress.nextCost}" aria-valuenow="${progress.max ? 100 : progress.currentXp}"><span style="width:${progress.max ? 100 : percent}%"></span></div><p>${progress.max ? 'Nível máximo. Seu XP continua sendo acumulado.' : `Faltam ${progress.remainingXp.toLocaleString('pt-BR')} XP para o nível ${progress.level + 1}.`}</p>${sync}</div>
    <p>Questões, revisões e estudo válido geram XP.</p>
    <details class="level-rules"><summary>Como ganhar XP ${icon('ArrowRight')}</summary><div>${LEVEL_RULES.map(([label, description]) => `<section><h3>${escapeHtml(label)}</h3><p>${escapeHtml(description)}</p></section>`).join('')}</div></details>
  </section>`;
}

export function profileView(state: SiteState, levelState: LevelState): ViewModel {
  const { questions } = getCatalog();
  const performance = questionsPerformance(state.answers);
  const settings = [
    ['Target', 'Minha meta', state.profile.targetRole || 'Definir cargo ou área', '/meta'],
    ['BarChart3', 'Desempenho', formatCount(performance.total, 'questão respondida', 'questões respondidas'), '/perfil/desempenho'],
    ['Bookmark', 'Concursos salvos', formatCount(state.savedConcursos.length, 'oportunidade', 'oportunidades'), '/concursos/salvos'],
    ['Crown', 'Plano e acesso', subscriptionPlanName(state.subscription.plan), '/perfil/planos'],
  ];
  const settingRow = ([iconName, label, description, route]: string[], danger = false) => `<button class="settings-row ${danger ? 'settings-row--danger' : ''}" type="button" data-route="${route}"><span class="settings-row__icon">${icon(iconName)}</span><span class="settings-row__copy"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(description)}</span></span>${icon('ArrowRight')}</button>`;
  return {
    title: 'Meu KAD',
    subtitle: state.auth.mode === 'authenticated' ? 'Dossiê do candidato' : 'Dados salvos neste navegador',
    content: `<div class="study-settings">
      <section class="profile-identity" aria-label="Identidade da conta">${avatar(state.profile.name, 'md', state.profile.avatarUri)}<div class="profile-identity__copy"><div class="question-meta">${badge(state.auth.mode === 'authenticated' ? 'Conta sincronizada' : 'Modo visitante', state.auth.mode === 'authenticated' ? 'success' : 'warning')}${badge(subscriptionPlanName(state.subscription.plan).replace('KAD ', '').replace('Plano ', ''), 'accent')}</div><h2>${escapeHtml(state.profile.name)}</h2><p>${escapeHtml(state.profile.email || state.profile.username || 'Seus dados estão salvos neste navegador')}</p></div>${button('Editar perfil', { route: '/perfil/editar', variant: 'secondary', iconName: 'Settings' })}</section>

      ${levelModule(levelState)}

      <div class="settings-sections">
        <section class="settings-section"><header><p class="eyebrow">ESTUDO</p><h2>Minha preparação</h2></header><div>${settings.slice(0, 3).map((item) => settingRow(item)).join('')}</div></section>
        <section class="settings-section"><header><p class="eyebrow">ACESSO</p><h2>Plano e desempenho</h2></header><div>${settingRow(settings[3])}${settingRow(['BarChart3', 'Estatísticas', 'Acompanhe seu progresso por matéria', '/perfil/desempenho'])}</div></section>
        <section class="settings-section"><header><p class="eyebrow">PREFERÊNCIAS</p><h2>Experiência</h2></header><div><button class="settings-row" type="button" data-action="toggle-theme"><span class="settings-row__icon">${icon('Sun')}</span><span class="settings-row__copy"><strong>Aparência</strong><span>Alternar entre tema claro e escuro</span></span>${icon('ArrowRight')}</button>${settingRow(['MessageCircle', 'Fale com o KAD', 'Envie sugestões e comentários', '/perfil/feedback'])}</div></section>
        <section class="settings-section"><header><p class="eyebrow">SEGURANÇA</p><h2>Conta e privacidade</h2></header><div>${settingRow(['KeyRound', 'Alterar senha', state.auth.mode === 'authenticated' ? 'Atualize seu acesso' : 'Disponível para contas conectadas', '/perfil/senha'])}<button class="settings-row" type="button" data-action="sign-out"><span class="settings-row__icon">${icon('LogOut')}</span><span class="settings-row__copy"><strong>${state.auth.mode === 'authenticated' ? 'Sair da conta' : 'Encerrar modo visitante'}</strong><span>Voltar à página inicial</span></span>${icon('ArrowRight')}</button>${settingRow(['Trash2', state.auth.mode === 'authenticated' ? 'Excluir conta' : 'Apagar dados deste navegador', 'Esta ação exige confirmação', '/perfil/excluir'], true)}</div></section>
      </div>
      <div class="toolbar__group profile-legal-links"><a class="text-link" href="/termos" data-route="/termos">Termos de Uso</a><span class="subtle" aria-hidden="true">·</span><a class="text-link" href="/privacidade" data-route="/privacidade">Política de Privacidade</a></div>
    </div>`,
  };
}

export function performanceView(state: SiteState): ViewModel {
  const { questions } = getCatalog();
  const performance = questionsPerformance(state.answers);
  const grouped = groupPerformance(questions, state.answers);
  return {
    title: 'Desempenho',
    subtitle: formatCount(performance.total, 'questão respondida', 'questões respondidas'),
    content: `
      ${stackHeader('Desempenho', formatCount(performance.total, 'questão respondida', 'questões respondidas'))}
      ${card(`<div class="result-hero"><div class="result-hero__copy"><p class="eyebrow">VISÃO GERAL</p><h2>${performance.total ? 'Seu estudo em números.' : 'Seu desempenho aparecerá aqui.'}</h2><p>${performance.total ? `${formatCount(performance.correct, 'acerto', 'acertos')} e ${formatCount(performance.wrong, 'erro registrado', 'erros registrados')} no banco de questões.` : 'Responda questões para começar a acompanhar acertos, erros e evolução por matéria.'}</p>${!performance.total ? button('Responder questões', { route: '/questoes', iconName: 'Play' }) : ''}</div>${metricRing(performance.accuracy, 'taxa de acerto')}</div>`)}
      <section class="home-metrics page-metrics" aria-label="Resumo do desempenho">${stat(String(performance.total), 'Questões respondidas', 'BookOpen')}${stat(String(performance.correct), 'Acertos', 'CheckCircle2', 'success')}${stat(String(performance.wrong), 'Erros', 'XCircle', 'danger')}${stat(String(state.favorites.length), 'Favoritas', 'Bookmark', 'warning')}</section>
      ${section('Revisar questões', `<div class="action-grid"><button class="action-card" type="button" data-route="/questoes/revisar?tipo=favoritas"><span class="action-card__icon">${icon('Bookmark')}</span><div><h3>Favoritas</h3><p>${formatCount(state.favorites.length, 'questão', 'questões')}</p></div></button><button class="action-card" type="button" data-route="/questoes/revisar?tipo=acertadas"><span class="action-card__icon">${icon('CheckCircle2')}</span><div><h3>Acertadas</h3><p>${formatCount(performance.correct, 'questão', 'questões')}</p></div></button><button class="action-card" type="button" data-route="/questoes/revisar?tipo=erradas"><span class="action-card__icon">${icon('RotateCcw')}</span><div><h3>Erradas</h3><p>${formatCount(performance.wrong, 'questão', 'questões')}</p></div></button></div>`)}
      ${section('Por matéria', grouped.length ? card(`<div class="performance-bars">${grouped.map((item) => `<div class="performance-row"><strong>${escapeHtml(item.name)}</strong>${progress(item.accuracy, `Acerto em ${item.name}`)}<span>${formatPercent(item.accuracy)}</span></div>`).join('')}</div>`) : emptyState('Sem dados por matéria', 'Seu desempenho será agrupado conforme você responder questões.'))}
    `,
  };
}

export function profileEditView(state: SiteState): ViewModel {
  return {
    title: 'Editar perfil',
    content: `${stackHeader('Editar dados', 'Atualize as informações exibidas no KAD')}<div class="form-page">${card(`<form class="form-stack" data-form="profile-edit"><div class="profile-photo-field">${avatar(state.profile.name, 'md', state.profile.avatarUri)}<div class="field"><label for="profile-avatar">Foto de perfil</label><input class="input" id="profile-avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" ${state.auth.mode === 'authenticated' ? '' : 'disabled'} /><small>${state.auth.mode === 'authenticated' ? 'JPG, PNG ou WebP de até 5 MB.' : 'Entre em uma conta para sincronizar uma foto.'}</small></div></div><div class="form-grid"><div class="field"><label for="profile-name">Nome completo</label><input class="input" id="profile-name" name="name" value="${escapeHtml(state.profile.name)}" required /></div><div class="field"><label for="profile-email">E-mail de acesso</label><input class="input" id="profile-email" name="email" type="email" value="${escapeHtml(state.profile.email)}" ${state.auth.mode === 'authenticated' ? 'readonly' : ''} /></div></div><div class="form-grid"><div class="field"><label for="profile-phone">Telefone</label><input class="input" id="profile-phone" name="phone" value="${escapeHtml(state.profile.phone)}" autocomplete="tel" /></div><div class="field"><label for="profile-city">Cidade</label><input class="input" id="profile-city" name="city" value="${escapeHtml(state.profile.city)}" autocomplete="address-level2" /></div></div><div class="field"><label for="profile-target">Cargo desejado</label><input class="input" id="profile-target" name="targetRole" value="${escapeHtml(state.profile.targetRole)}" /></div><p class="form-message" data-form-message></p>${button('Salvar alterações', { type: 'submit', iconName: 'Save', size: 'lg' })}</form>`, 'form-panel')}</div>`,
  };
}

export function goalView(state: SiteState): ViewModel {
  return {
    title: 'Minha meta',
    content: `${stackHeader('Escolha sua meta', 'Personalize recomendações e ritmo semanal')}<div class="form-page">${card(`<form class="form-stack" data-form="goal"><div class="field"><label for="goal-target">Cargo, área ou concurso</label><input class="input" id="goal-target" name="targetRole" value="${escapeHtml(state.profile.targetRole)}" placeholder="Ex.: Analista Judiciário" /></div><div class="field"><label for="goal-weekly">Meta semanal</label><select class="select" id="goal-weekly" name="weeklyGoal">${[15, 30, 50, 75, 100].map((value) => `<option value="${value}" ${state.preferences.weeklyGoal === value ? 'selected' : ''}>${value} questões</option>`).join('')}</select></div><p class="form-message" data-form-message></p>${button('Salvar meta', { type: 'submit', iconName: 'Target' })}</form>`, 'form-panel')}</div>`,
  };
}

export function plansView(
  state: SiteState,
  params: ViewParams = {},
  checkoutProgress: CheckoutProgress | null = null
): ViewModel {
  const plans = [
    { name: 'Básico', price: 'Grátis', period: '', cycle: '', features: ['Questões ilimitadas', 'Correção e gabarito comentado'], featured: false },
    { name: 'Diamond mensal', price: 'R$ 14,99', period: '/mês', cycle: 'monthly', features: ['Tudo do Básico', 'Simulados personalizados', 'Desempenho por disciplina', 'Revisão de erros e favoritas'], featured: false },
    { name: 'Diamond trimestral', price: 'R$ 39,99', period: '/3 meses', cycle: 'quarterly', features: ['Tudo do Diamond', 'Economia de 11%', 'Cobrança trimestral', 'Cancele quando quiser'], featured: true },
    { name: 'Diamond anual', price: 'R$ 149,99', period: '/ano', cycle: 'annual', features: ['Tudo do Diamond', 'Economia de 17%', 'Cobrança anual', 'Cancele quando quiser'], featured: false },
  ];
  const premium = subscriptionHasAccess(state.subscription);
  const planName = subscriptionPlanName(state.subscription.plan);
  const checkoutFeedback = params.checkout
    ? checkoutFeedbackFor(checkoutProgress, state.subscription)
    : null;
  const checkoutFeedbackCard = checkoutFeedback
    ? card(`<div class="detail-panel" role="status"><span class="badge badge--${checkoutFeedback.tone}">${icon(checkoutFeedback.iconName)} ${checkoutFeedback.title}</span><p class="muted">${checkoutFeedback.message}</p>${checkoutFeedback.canRetry ? `<div class="welcome__actions">${button('Consultar novamente', { action: 'retry-checkout', variant: 'secondary', iconName: 'RotateCcw' })}</div>` : ''}</div>`)
    : '';
  const activeSubscriptionCard = premium
    ? card(`<div class="detail-panel"><div class="contest-card__heading"><div><p class="eyebrow">SEU PLANO</p><h2>${planName}</h2></div>${badge(state.subscription.autoRenew ? 'Ativo' : 'Renovação cancelada', state.subscription.autoRenew ? 'success' : 'warning')}</div><p class="muted">${state.subscription.renewsAt ? `Acesso disponível até ${new Intl.DateTimeFormat('pt-BR').format(new Date(state.subscription.renewsAt))}.` : 'Acesso premium confirmado pelo servidor.'}</p><div class="welcome__actions">${button('Atualizar assinatura', { action: 'refresh-subscription', variant: 'secondary', iconName: 'RotateCcw' })}${state.subscription.autoRenew ? button('Cancelar renovação', { action: 'cancel-subscription', variant: 'danger' }) : ''}</div></div>`)
    : '';
  const planCards = plans.map((plan) => card(
    `<div class="contest-card__heading"><h2>${plan.name}</h2>${plan.featured ? badge('Recomendado', 'accent') : plan.name === 'Básico' ? badge(state.subscription.plan === 'basic' ? 'Seu plano' : 'Grátis') : ''}</div><p class="plan-price">${plan.price} <span>${plan.period}</span></p><ul class="benefit-list">${plan.features.map((feature) => `<li>${icon('Check')}${feature}</li>`).join('')}</ul>${plan.name === 'Básico' ? button(state.subscription.plan === 'basic' ? 'Plano atual' : 'Plano gratuito', { disabled: true, variant: 'secondary', className: 'full-width' }) : button(premium ? `${planName} ativo` : 'Continuar para assinatura', { action: 'start-checkout', iconName: 'Crown', className: 'full-width', disabled: premium, attrs: `data-cycle="${plan.cycle}"` })}`,
    `plan-card ${plan.featured ? 'is-featured' : ''}`
  )).join('');
  return {
    title: 'Planos e assinatura',
    subtitle: premium ? `Seu acesso ${planName} está ativo` : 'Escolha o acesso ideal para sua preparação',
    content: `${stackHeader('Planos e assinatura', 'Benefícios claros, sem esconder condições')}${checkoutFeedbackCard}${activeSubscriptionCard}<div class="plan-grid">${planCards}</div>${card(`<div class="detail-panel"><span class="badge badge--success">${icon('ShieldCheck')} Pagamento seguro</span><p class="muted">O checkout é criado pela função protegida do KAD e aberto somente quando o endereço pertence ao Mercado Pago. Nenhum dado de pagamento passa por este site.</p></div>`)}`,
  };
}

export function feedbackView(state: SiteState): ViewModel {
  return {
    title: 'Fale com o KAD',
    content: `${stackHeader('Fale com o KAD', 'Ajude a construir uma experiência melhor')}<div class="form-page">${card(`<form class="form-stack" data-form="feedback"><div class="field"><label for="feedback-kind">Assunto</label><select class="select" id="feedback-kind" name="kind"><option value="suggestion">Sugestão</option><option value="problem">Problema</option><option value="question">Dúvida</option></select></div><div class="field"><label for="feedback-message">Comentário</label><textarea class="textarea" id="feedback-message" name="message" minlength="3" maxlength="1200" placeholder="Conte o que podemos melhorar" required></textarea><small>Não inclua senhas nem dados sensíveis.</small></div><p class="form-message" data-form-message>${state.feedback.length ? `${formatCount(state.feedback.length, 'comentário salvo', 'comentários salvos')} neste navegador.` : ''}</p>${button('Enviar para o KAD', { type: 'submit', iconName: 'Send' })}</form>`, 'form-panel')}</div>`,
  };
}

export function passwordView(state: SiteState): ViewModel {
  return {
    title: 'Alterar senha',
    content: `${stackHeader('Alterar senha', 'Proteja o acesso à sua conta')}<div class="form-page">${state.auth.mode !== 'authenticated' ? emptyState('Entre em uma conta para alterar a senha', 'No modo visitante não existe uma senha armazenada.', { route: '/entrar', actionLabel: 'Entrar na conta' }) : card(`<form class="form-stack" data-form="password-change">${passwordField({ id: 'password-current', label: 'Senha atual', name: 'currentPassword', autocomplete: 'current-password' })}${passwordField({ id: 'password-new', label: 'Nova senha', autocomplete: 'new-password' })}${passwordField({ id: 'password-new-confirm', label: 'Confirmar nova senha', name: 'passwordConfirmation', autocomplete: 'new-password' })}<p class="form-message" data-form-message aria-live="polite"></p>${button('Salvar nova senha', { type: 'submit', iconName: 'KeyRound' })}</form>`, 'form-panel')}</div>`,
  };
}

export function deleteView(state: SiteState): ViewModel {
  return {
    title: state.auth.mode === 'authenticated' ? 'Excluir conta' : 'Apagar dados',
    content: `${stackHeader(state.auth.mode === 'authenticated' ? 'Excluir conta' : 'Apagar dados deste navegador', 'Esta ação não pode ser desfeita')}<div class="form-page">${card(`<form class="form-stack" data-form="delete-data"><span class="empty-state__icon">${icon('Trash2')}</span><h2>${state.auth.mode === 'authenticated' ? 'Confirme a exclusão da conta' : 'Remover todo o progresso local?'}</h2><p class="muted">Respostas, favoritos, simulados, redações, comentários, flashcards e preferências serão removidos.${state.auth.mode === 'authenticated' ? ' A conta e os dados sincronizados também serão excluídos do KAD.' : ' A remoção vale somente para este navegador.'}</p>${state.auth.mode === 'authenticated' ? passwordField({ id: 'delete-current-password', label: 'Senha atual', name: 'currentPassword', autocomplete: 'current-password' }) : ''}<div class="field"><label for="delete-confirmation">Digite APAGAR para confirmar</label><input class="input" id="delete-confirmation" name="confirmation" autocomplete="off" required /></div><p class="form-message" data-form-message></p>${button(state.auth.mode === 'authenticated' ? 'Excluir minha conta' : 'Apagar meus dados', { type: 'submit', variant: 'danger', iconName: 'Trash2' })}</form>`, 'form-panel')}</div>`,
  };
}
