import { getCatalog } from '../data/catalog.ts';
import { escapeHtml, formatCount, formatPercent, localDay, questionsPerformance } from '../core/utils.ts';
import { badge, button, icon, progress, section, studyNextAction, studyPlanRow } from '../ui/components.ts';
import type { SiteState, ViewModel } from '../types/domain.ts';

export function homeView(state: SiteState): ViewModel {
  const catalog = getCatalog();
  const performance = questionsPerformance(state.answers);
  const weeklyAnswered = Object.values(state.activityByDate).slice(-7).flat().length;
  const weeklyProgress = Math.min(100, (weeklyAnswered / state.preferences.weeklyGoal) * 100);
  const todayCount = (state.activityByDate[localDay()] ?? []).length;
  const firstName = state.profile.name.trim().split(/\s+/)[0] || 'Estudante';
  const savedFocus = catalog.concursos.find((item) => state.savedConcursos.includes(item.id));
  const focus = savedFocus ?? catalog.concursos.find((item) => item.status === 'aberto');
  const recentAnswers = Object.values(state.answers)
    .sort((left, right) => right.answeredAt.localeCompare(left.answeredAt))
    .slice(0, 3);

  const weeklyRemaining = Math.max(0, state.preferences.weeklyGoal - weeklyAnswered);
  const weeklyMessage = weeklyProgress >= 100
    ? 'Meta concluída. Escolha uma revisão curta para manter o ritmo.'
    : weeklyAnswered
      ? `${formatCount(weeklyRemaining, 'questão restante', 'questões restantes')} nesta semana.`
      : 'Comece pequeno: uma sessão curta já coloca o plano em movimento.';

  const nextTitle = performance.total ? 'Continue praticando com o seu histórico.' : 'Comece com uma questão.';
  const nextDescription = performance.total
    ? `${formatCount(performance.total, 'questão respondida', 'questões respondidas')} · ${formatPercent(performance.accuracy)} de acerto`
    : 'Escolha uma matéria, responda no seu tempo e aprenda com o comentário do gabarito.';

  const todayPlan = [
    studyPlanRow({
      index: 1,
      title: performance.wrong ? 'Revisar questões erradas' : 'Fazer a primeira revisão',
      description: performance.wrong ? formatCount(performance.wrong, 'erro para revisar', 'erros para revisar') : 'Crie histórico para liberar sua fila de revisão',
      route: performance.wrong ? '/questoes/revisar?tipo=erradas' : '/questoes',
      status: performance.wrong ? 'current' : 'next',
    }),
    studyPlanRow({
      index: 2,
      title: 'Praticar uma matéria',
      description: 'Sessão curta por disciplina e assunto',
      route: '/questoes',
      status: todayCount ? 'complete' : 'current',
    }),
    studyPlanRow({
      index: 3,
      title: focus ? `Avançar na preparação para ${focus.shortName}` : 'Definir um concurso-alvo',
      description: focus ? `${focus.organ} · ${focus.state}` : 'Organize matérias e próximos passos',
      route: focus ? `/concursos/${focus.id}` : '/concursos',
    }),
  ].join('');

  const recent = recentAnswers.length
    ? `<div class="study-history">${recentAnswers.map((answer) => {
        const question = catalog.questions.find((item) => item.id === answer.questionId);
        return `<button class="study-history__row" type="button" data-action="open-question" data-question-id="${escapeHtml(answer.questionId)}"><span class="study-history__status study-history__status--${answer.isCorrect ? 'success' : 'warning'}">${icon(answer.isCorrect ? 'Check' : 'RotateCcw')}</span><span><strong>${escapeHtml(question?.topic ?? answer.subject)}</strong><small>${answer.isCorrect ? 'Concluída' : 'Separada para revisão'} · ${escapeHtml(question?.board ?? 'KAD')}</small></span>${icon('ArrowRight')}</button>`;
      }).join('')}</div>`
    : `<div class="study-empty-line"><span>${icon('BookOpen')}</span><div><strong>Seu histórico começa na primeira resposta.</strong><p>Sem gráficos vazios: quando houver dados, eles aparecem aqui.</p></div></div>`;

  return {
    title: `Olá, ${firstName}`,
    subtitle: state.profile.targetRole || 'Seu ponto de continuidade',
    content: `<div class="study-desk">
      <div class="study-desk__continuity">
        ${studyNextAction({
          title: nextTitle,
          description: nextDescription,
          route: '/questoes',
          actionLabel: performance.total ? 'Continuar estudo' : 'Responder primeira questão',
          secondary: button('Montar simulado', { route: '/simulados', variant: 'ghost', iconName: 'Timer' }),
        })}
        <aside class="weekly-focus" aria-label="Meta da semana">
          <p class="eyebrow">Meta da semana</p>
          <div class="weekly-focus__value"><strong>${weeklyAnswered} de ${state.preferences.weeklyGoal}</strong><span>questões</span></div>
          ${progress(weeklyProgress, `Meta semanal: ${weeklyAnswered} de ${state.preferences.weeklyGoal}`, weeklyProgress >= 100 ? 'success' : 'warning')}
          <p>${weeklyMessage}</p>
          ${button('Ajustar meta', { route: '/meta', variant: 'ghost', size: 'sm', iconName: 'Settings2' })}
        </aside>
      </div>

      ${section('Um plano curto, em ordem', `<div class="study-plan">${todayPlan}</div>`, {
        eyebrow: 'HOJE',
        action: button('Buscar questões', { route: '/questoes/buscar', variant: 'ghost', size: 'sm', iconName: 'Search' }),
      })}

      <div class="study-desk__lower">
        ${section('Atividade recente', recent, { eyebrow: 'SEU HISTÓRICO' })}
        <aside class="study-objective">
          <p class="eyebrow">PRÓXIMO OBJETIVO</p>
          ${focus ? `<div class="study-objective__heading"><strong>${escapeHtml(focus.shortName)}</strong>${savedFocus ? badge('Salvo', 'success') : badge('Sugestão', 'accent')}</div><h2>${escapeHtml(focus.title)}</h2><p>${escapeHtml(focus.organ)} · ${escapeHtml(focus.state)}</p>${button(savedFocus ? 'Ver minha meta' : 'Conhecer concurso', { route: `/concursos/${focus.id}`, variant: 'secondary' })}` : `<h2>Escolha uma direção</h2><p>Salve um concurso para organizar seu percurso.</p>${button('Explorar concursos', { route: '/concursos', variant: 'secondary' })}`}
        </aside>
      </div>
    </div>`,
  };
}
