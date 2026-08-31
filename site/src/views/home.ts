import { getCatalog } from '../data/catalog.ts';
import { escapeHtml, formatCurrency, formatPercent, localDay, questionsPerformance } from '../core/utils.ts';
import { badge, button, icon, progress, section, stat } from '../ui/components.ts';
import type { SiteState, ViewModel } from '../types/domain.ts';

export function homeView(state: SiteState): ViewModel {
  const catalog = getCatalog();
  const performance = questionsPerformance(state.answers);
  const todayCount = (state.activityByDate[localDay()] ?? []).length;
  const weeklyAnswered = Object.values(state.activityByDate).slice(-7).flat().length;
  const weeklyProgress = Math.min(100, (weeklyAnswered / state.preferences.weeklyGoal) * 100);
  const firstName = state.profile.name.trim().split(/\s+/)[0] || 'Estudante';
  const savedFocus = catalog.concursos.find((item) => state.savedConcursos.includes(item.id));
  const focus = savedFocus ?? catalog.concursos.find((item) => item.status === 'aberto');
  const hasStudyActivity = performance.total > 0;
  const recentAnswers = Object.values(state.answers)
    .sort((left, right) => right.answeredAt.localeCompare(left.answeredAt))
    .slice(0, 4);

  const actions = [
    ['BookOpen', 'Questões', 'Pratique por disciplina e assunto', '/questoes', 'Explorar banco'],
    ['Timer', 'Simulados', 'Treine tempo e estratégia de prova', '/simulados', 'Montar simulado'],
    ['Compass', 'Trilhas', 'Siga uma sequência progressiva', '/trilhas', 'Ver trilhas'],
  ];

  const recent = recentAnswers.length
    ? `<div class="home-activity-list">${recentAnswers.map((answer) => {
        const question = catalog.questions.find((item) => item.id === answer.questionId);
        return `<button class="list-row" type="button" data-action="open-question" data-question-id="${escapeHtml(answer.questionId)}"><span class="list-row__icon">${icon(answer.isCorrect ? 'CheckCircle2' : 'XCircle')}</span><span class="list-row__copy"><strong>${escapeHtml(question?.topic ?? answer.subject)}</strong><span>${answer.isCorrect ? 'Resposta correta' : 'Vale revisar esta questão'} · ${escapeHtml(question?.board ?? 'KAD')}</span></span>${icon('ChevronRight')}</button>`;
      }).join('')}</div>`
    : `<div class="home-empty">
        <span class="home-empty__icon">${icon('BookOpen')}</span>
        <div><h3>Seu histórico começa aqui</h3><p>Responda sua primeira questão para acompanhar sua evolução nesta página.</p></div>
        ${button('Praticar agora', { route: '/questoes', variant: 'secondary' })}
      </div>`;

  const focusCard = focus
    ? `<div class="home-contest">
        <div class="contest-card__heading"><span class="contest-mark">${escapeHtml(focus.shortName)}</span><div class="question-meta">${savedFocus ? '' : badge('Sugestão', 'accent')}${badge(focus.status === 'aberto' ? 'Inscrições abertas' : 'Acompanhar', focus.status === 'aberto' ? 'success' : 'warning')}</div></div>
        <div><h3>${escapeHtml(focus.title)}</h3><p class="contest-card__organ">${escapeHtml(focus.organ)} · ${escapeHtml(focus.state)}</p></div>
        <dl class="home-contest__facts">
          <div><dt>Vagas</dt><dd>${focus.vacancies.toLocaleString('pt-BR')}</dd></div>
          <div><dt>Salário até</dt><dd>${formatCurrency(focus.salaryMax)}</dd></div>
        </dl>
        ${button(savedFocus ? 'Ver minha meta' : 'Conhecer concurso', { route: `/concursos/${focus.id}`, variant: 'secondary', className: 'full-width' })}
      </div>`
    : `<div class="home-contest home-contest--empty"><p>Salve um concurso para acompanhar sua meta e seus próximos passos.</p>${button('Explorar concursos', { route: '/concursos', variant: 'secondary' })}</div>`;

  const studySummary = hasStudyActivity ? `
      <section class="home-metrics" aria-label="Resumo da preparação">
        ${stat(String(todayCount), 'Questões hoje', 'CheckCircle2', 'success')}
        ${stat(`${weeklyAnswered}/${state.preferences.weeklyGoal}`, 'Meta semanal', 'Flag')}
        ${stat(formatPercent(performance.accuracy), 'Taxa de acerto', 'TrendingUp', 'success')}
        ${stat(String(state.favorites.length), 'Questões favoritas', 'Bookmark', 'warning')}
      </section>` : '';

  const weeklyMessage = weeklyProgress >= 100
    ? 'Meta concluída. Excelente constância!'
    : weeklyAnswered
      ? `Faltam ${Math.max(0, state.preferences.weeklyGoal - weeklyAnswered)} questões para concluir a meta.`
      : 'Comece com uma questão e construa seu ritmo durante a semana.';

  const nextStepDescription = performance.total
    ? `Você já respondeu ${performance.total} questões e está com ${formatPercent(performance.accuracy)} de acerto. Continue de onde parou.`
    : 'Escolha uma disciplina, responda no seu tempo e use o comentário do gabarito para aprender de verdade.';

  return {
    title: `Olá, ${firstName}`,
    subtitle: state.profile.targetRole ? `Central KAD · ${state.profile.targetRole}` : 'Sua central de preparação',
    content: `
      <div class="home-dashboard">
        <section class="home-intro" aria-labelledby="home-next-step">
          <div class="home-intro__copy">
            <p class="eyebrow">SEU PRÓXIMO PASSO</p>
            <h2 id="home-next-step">${performance.total ? 'Continue transformando prática em confiança.' : 'Sua preparação começa com uma questão.'}</h2>
            <p>${nextStepDescription}</p>
            <div class="home-intro__actions">
              ${button(performance.total ? 'Continuar praticando' : 'Responder primeira questão', { route: '/questoes', iconName: 'Play' })}
              ${button('Montar um simulado', { route: '/simulados', variant: 'ghost', iconName: 'Timer' })}
            </div>
          </div>
          <figure class="home-intro__visual" aria-hidden="true">
            <span class="home-intro__orbit"></span>
            <span class="home-intro__mark"><strong>KAD</strong><i></i></span>
          </figure>
        </section>

        ${studySummary}

        <div class="home-workspace">
          <div class="home-workspace__primary">
            ${section('Praticar agora', `<div class="home-action-list">${actions.map(([iconName, title, description, route, callToAction]) => `<button type="button" class="home-action-row" data-route="${route}"><span class="home-action-row__icon">${icon(iconName)}</span><span class="home-action-row__copy"><strong>${title}</strong><span>${description}</span></span><span class="home-action-row__cta">${callToAction}${icon('ArrowRight')}</span></button>`).join('')}</div>`, { eyebrow: 'ESTUDO', action: button('Buscar questões', { route: '/questoes/buscar', variant: 'ghost', size: 'sm', iconName: 'Search' }) })}

            <nav class="home-resource-links" aria-label="Outros recursos de estudo">
              <span>Outros recursos</span>
              <button type="button" data-route="/redacao">${icon('PenLine')}Redação</button>
              <button type="button" data-route="/biblioteca">${icon('Library')}Biblioteca</button>
              <button type="button" data-route="/questoes/desafio">${icon('Zap')}Desafio rápido</button>
            </nav>

            ${section('Atividade recente', recent, { action: recentAnswers.length ? button('Revisar respostas', { route: '/questoes/revisar?tipo=respondidas', variant: 'ghost', size: 'sm' }) : '' })}
          </div>

          <aside class="home-workspace__aside" aria-label="Resumo complementar">
            ${section('Meta da semana', `<div class="home-weekly">
              <div class="home-weekly__heading"><strong>${weeklyAnswered} de ${state.preferences.weeklyGoal}</strong><span>questões</span></div>
              ${progress(weeklyProgress, `Meta semanal: ${weeklyAnswered} de ${state.preferences.weeklyGoal}`)}
              <p>${weeklyMessage}</p>
              ${button('Ajustar meta', { route: '/meta', variant: 'ghost', size: 'sm', iconName: 'Settings2' })}
            </div>`, { eyebrow: 'SEU RITMO' })}
            ${section(savedFocus ? 'Minha meta' : focus ? 'Concurso em destaque' : 'Defina sua meta', focusCard, { eyebrow: 'PRÓXIMO OBJETIVO' })}
          </aside>
        </div>
      </div>`,
  };
}
