import { getCatalog } from '../data/catalog.js';
import { escapeHtml, formatCurrency, formatPercent, localDay, questionsPerformance } from '../core/utils.js';
import { badge, button, card, icon, progress, section, stat } from '../ui/components.js';

export function homeView(state) {
  const catalog = getCatalog();
  const performance = questionsPerformance(state.answers);
  const todayCount = (state.activityByDate[localDay()] ?? []).length;
  const weeklyAnswered = Object.values(state.activityByDate).slice(-7).flat().length;
  const weeklyProgress = Math.min(100, (weeklyAnswered / state.preferences.weeklyGoal) * 100);
  const firstName = state.profile.name.trim().split(/\s+/)[0] || 'Estudante';
  const focus = catalog.concursos.find((item) => state.savedConcursos.includes(item.id)) ?? catalog.concursos.find((item) => item.status === 'aberto');
  const recentAnswers = Object.values(state.answers)
    .sort((left, right) => right.answeredAt.localeCompare(left.answeredAt))
    .slice(0, 4);

  const actions = [
    ['BookOpen', 'Questões', 'Pratique por disciplina e assunto', '/questoes'],
    ['Timer', 'Simulados', 'Treine tempo e estratégia de prova', '/simulados'],
    ['Compass', 'Trilhas', 'Siga uma sequência progressiva', '/trilhas'],
  ];

  const recent = recentAnswers.length
    ? card(`<div class="list">${recentAnswers.map((answer) => {
        const question = catalog.questions.find((item) => item.id === answer.questionId);
        return `<button class="list-row" type="button" data-action="open-question" data-question-id="${escapeHtml(answer.questionId)}"><span class="list-row__icon">${icon(answer.isCorrect ? 'CheckCircle2' : 'XCircle')}</span><span class="list-row__copy"><strong>${escapeHtml(question?.topic ?? answer.subject)}</strong><span>${answer.isCorrect ? 'Resposta correta' : 'Vale revisar esta questão'} · ${escapeHtml(question?.board ?? 'KAD')}</span></span>${icon('ChevronRight')}</button>`;
      }).join('')}</div>`)
    : card(`<div class="empty-state"><span class="empty-state__icon">${icon('BookOpen')}</span><h2>Seu histórico começa aqui</h2><p>Responda sua primeira questão e acompanhe o avanço nesta página.</p>${button('Praticar agora', { route: '/questoes', variant: 'secondary' })}</div>`, 'card--empty');

  const focusCard = focus
    ? card(`<div class="detail-panel"><div class="contest-card__heading"><span class="contest-mark">${escapeHtml(focus.shortName)}</span>${badge(focus.status === 'aberto' ? 'Inscrições abertas' : 'Acompanhar', focus.status === 'aberto' ? 'success' : 'warning')}</div><div><h3>${escapeHtml(focus.title)}</h3><p class="contest-card__organ">${escapeHtml(focus.organ)} · ${escapeHtml(focus.state)}</p></div><div class="detail-row"><span>Vagas</span><strong>${focus.vacancies.toLocaleString('pt-BR')}</strong></div><div class="detail-row"><span>Salário até</span><strong>${formatCurrency(focus.salaryMax)}</strong></div>${button('Ver concurso', { route: `/concursos/${focus.id}`, variant: 'secondary', className: 'full-width' })}</div>`)
    : card(`<div class="empty-state"><p>Salve um concurso para acompanhar sua meta.</p>${button('Explorar concursos', { route: '/concursos', variant: 'secondary' })}</div>`);

  return {
    title: `Olá, ${firstName}`,
    subtitle: state.profile.targetRole ? `Central KAD · ${state.profile.targetRole}` : 'Sua central de preparação',
    content: `
      ${card(`
        <div class="hero-card__content">
          <p class="eyebrow">SEU PRÓXIMO PASSO</p>
          <h2>${performance.total ? 'Continue transformando prática em confiança.' : 'Sua preparação começa com uma questão.'}</h2>
          <p>${performance.total ? `Você já respondeu ${performance.total} questões e está com ${formatPercent(performance.accuracy)} de acerto. Mantenha o ritmo.` : 'Escolha uma disciplina, responda no seu tempo e use o comentário do gabarito para aprender de verdade.'}</p>
          ${button(performance.total ? 'Continuar praticando' : 'Responder primeira questão', { route: '/questoes', iconName: 'Play' })}
        </div>
        <div class="hero-card__art"><img src="/assets/kad-mascot-practice.png" alt="" width="310" height="310" /></div>
      `, 'hero-card')}

      <div class="summary-grid" aria-label="Resumo da preparação">
        ${card(stat(String(todayCount), 'Questões hoje', 'CheckCircle2', 'success'))}
        ${card(stat(`${weeklyAnswered}/${state.preferences.weeklyGoal}`, 'Meta semanal', 'Flag'))}
        ${card(stat(formatPercent(performance.accuracy), 'Taxa de acerto', 'TrendingUp', 'success'))}
        ${card(stat(String(state.favorites.length), 'Questões favoritas', 'Bookmark', 'warning'))}
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-main">
          ${section('Praticar agora', `<div class="action-grid">${actions.map(([iconName, title, description, route]) => `<button type="button" class="action-card" data-route="${route}"><span class="action-card__icon">${icon(iconName)}</span><div><h3>${title}</h3><p>${description}</p></div></button>`).join('')}</div>`, { eyebrow: 'ESTUDO' })}
          ${section('Atividade recente', recent)}
          ${section('Explorar', `<div class="action-grid">
            <button type="button" class="action-card" data-route="/redacao"><span class="action-card__icon">${icon('PenLine')}</span><div><h3>Redação</h3><p>Escolha um tema e pratique sua escrita</p></div></button>
            <button type="button" class="action-card" data-route="/biblioteca"><span class="action-card__icon">${icon('Library')}</span><div><h3>Biblioteca</h3><p>Prepare suas próximas revisões</p></div></button>
            <button type="button" class="action-card" data-route="/questoes/desafio"><span class="action-card__icon">${icon('Zap')}</span><div><h3>Desafio rápido</h3><p>Três questões em cerca de cinco minutos</p></div></button>
          </div>`)}
        </div>
        <aside class="dashboard-aside" aria-label="Resumo complementar">
          ${section('Seu ritmo', card(`<div class="detail-panel"><div class="toolbar"><strong>${weeklyAnswered} questões</strong><span class="muted">últimos 7 dias</span></div>${progress(weeklyProgress, `Meta semanal: ${weeklyAnswered} de ${state.preferences.weeklyGoal}`)}<p class="muted">${weeklyProgress >= 100 ? 'Meta concluída. Excelente constância!' : `Faltam ${Math.max(0, state.preferences.weeklyGoal - weeklyAnswered)} para concluir a meta.`}</p>${button('Ajustar meta', { route: '/meta', variant: 'ghost', size: 'sm' })}</div>`))}
          ${section('Minha meta', focusCard)}
        </aside>
      </div>`,
  };
}
