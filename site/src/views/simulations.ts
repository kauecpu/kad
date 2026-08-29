import { getCatalog } from '../data/catalog.ts';
import { clamp, escapeHtml, filterQuestions, formatPercent, formatTimer, matchesPack, randomId, shuffle, unique } from '../core/utils.ts';
import { badge, button, card, emptyState, icon, metricRing, progress, section, stat, workspaceHero } from '../ui/components.ts';
import { stackHeader } from '../ui/layout.ts';
import type { SiteSimulationConfig, SiteSimulationSession, SiteState, ViewModel } from '../types/domain.ts';

type ViewParams = Record<string, string | undefined>;
type SimulationInput = Partial<Omit<SiteSimulationConfig, 'questionCount' | 'durationMinutes'>> & {
  questionCount?: string | number;
  durationMinutes?: string | number;
};

export function createSimulation(config: SimulationInput = {}): SiteSimulationSession | null {
  const { questions, packs } = getCatalog();
  const pack = config.packId ? packs.find((item) => item.id === config.packId) : undefined;
  let candidates = filterQuestions(questions, {
    discipline: config.discipline,
    board: config.board,
    difficulty: config.difficulty,
    pack,
  });
  if (config.shuffleQuestions !== false) candidates = shuffle(candidates);
  const count = Math.min(Math.max(1, Number(config.questionCount) || 10), candidates.length);
  if (!count) return null;
  const selected = candidates.slice(0, count);
  const now = new Date().toISOString();
  return {
    id: randomId('simulado'),
    status: 'active',
    config: {
      packId: pack?.id ?? '',
      discipline: config.discipline ?? '',
      board: config.board ?? '',
      difficulty: config.difficulty ?? '',
      questionCount: selected.length,
      durationMinutes: Math.max(5, Number(config.durationMinutes) || 20),
      shuffleQuestions: config.shuffleQuestions !== false,
    },
    questionIds: selected.map((question) => question.id),
    answers: {},
    currentIndex: 0,
    remainingSeconds: Math.max(5, Number(config.durationMinutes) || 20) * 60,
    createdAt: now,
    updatedAt: now,
  };
}

export function simulationScore(session: SiteSimulationSession) {
  const { questions } = getCatalog();
  const items = session.questionIds.map((id) => {
    const question = questions.find((candidate) => candidate.id === id);
    const selected = session.answers[id];
    return question ? { question, selected, correct: selected === question.correct } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const answered = items.filter((item) => item.selected).length;
  const correct = items.filter((item) => item.correct).length;
  return {
    items,
    total: items.length,
    answered,
    correct,
    wrong: answered - correct,
    blank: items.length - answered,
    accuracy: items.length ? (correct / items.length) * 100 : 0,
  };
}

export function simulationsView(state: SiteState): ViewModel {
  const { packs } = getCatalog();
  const current = state.simulations.current;
  const history = state.simulations.history.slice(0, 4);
  const historyScores = history.map((item) => simulationScore(item));
  const featuredPacks = packs.slice(0, 6);
  const historySummary = history.length ? `
      <section class="home-metrics page-metrics" aria-label="Resumo dos simulados">
        ${stat(String(history.length), 'Simulados concluídos', 'ClipboardCheck')}
        ${stat(formatPercent(historyScores.reduce((sum, item) => sum + item.accuracy, 0) / history.length), 'Média de acerto', 'TrendingUp', 'success')}
        ${stat(String(historyScores.reduce((sum, item) => sum + item.answered, 0)), 'Questões treinadas', 'BookOpen')}
        ${stat(formatPercent(Math.max(...historyScores.map((item) => item.accuracy))), 'Melhor resultado', 'Trophy', 'warning')}
      </section>` : '';
  return {
    title: 'Simulados',
    subtitle: 'Monte provas, controle o tempo e acompanhe sua evolução',
    content: `
      ${current && current.status !== 'completed'
        ? workspaceHero({
            id: 'simulation-overview',
            eyebrow: 'SIMULADO EM ANDAMENTO',
            title: 'Seu treino está esperando.',
            description: `${Object.keys(current.answers).length} de ${current.questionIds.length} questões respondidas · ${formatTimer(current.remainingSeconds)} restantes.`,
            actions: button(current.status === 'paused' ? 'Retomar simulado' : 'Continuar simulado', { route: '/simulados/em-andamento', iconName: 'Play' }),
            imageSrc: '/assets/kad-mascot-simulation.png',
          })
        : workspaceHero({
            id: 'simulation-overview',
            eyebrow: 'SIMULADOS KAD',
            title: 'Treine como se fosse o dia da prova.',
            description: 'Escolha o conteúdo, defina o tempo e acompanhe seu resultado ao final.',
            actions: `${button('Montar simulado', { route: '/simulados/configurar', iconName: 'Timer' })}${button('Simulado rápido', { action: 'start-demo-simulation', variant: 'secondary', iconName: 'Play' })}`,
            imageSrc: '/assets/kad-mascot-simulation.png',
          })}
      ${section('Por concurso e área', `<div class="discipline-grid">${featuredPacks.map((pack) => {
        const total = getCatalog().questions.filter((question) => matchesPack(question, pack)).length;
        return `<button class="discipline-card" type="button" data-route="/simulados/configurar?packId=${pack.id}" style="--discipline-color:${pack.color}"><span class="discipline-card__mark">${escapeHtml(pack.name.slice(0, 2).toUpperCase())}</span><span class="discipline-card__copy"><h3>${escapeHtml(pack.name)}</h3><p>${total} ${total === 1 ? 'questão disponível' : 'questões disponíveis'}</p></span>${pack.kind === 'concurso' ? badge('Concurso') : badge('Área')}</button>`;
      }).join('')}</div>`)}
      ${historySummary}
      ${section('Histórico recente', history.length ? `<div class="dashboard-main result-list">${history.map((session) => {
        const score = simulationScore(session);
        return `<button class="list-row result-row" type="button" data-action="open-simulation-result" data-simulation-id="${session.id}"><span class="list-row__icon">${icon('BarChart3')}</span><span class="list-row__copy"><strong>${session.config.packId ? escapeHtml(packs.find((pack) => pack.id === session.config.packId)?.name ?? 'Simulado') : 'Simulado personalizado'}</strong><span>${score.correct} acertos de ${score.total} · ${new Intl.DateTimeFormat('pt-BR').format(new Date(session.completedAt ?? session.createdAt))}</span></span>${badge(formatPercent(score.accuracy), score.accuracy >= 70 ? 'success' : 'warning')}${icon('ChevronRight')}</button>` }).join('')}</div>` : emptyState('Nenhum simulado concluído', 'Monte seu primeiro treino para criar um histórico de desempenho.', { route: '/simulados/configurar', actionLabel: 'Montar simulado' }))}
    `,
  };
}

export function simulationConfigView(params: ViewParams = {}): ViewModel {
  const { questions, disciplines, packs } = getCatalog();
  const boards = unique(questions.map((question) => question.board)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const selectedPack = packs.find((pack) => pack.id === params.packId);
  return {
    title: 'Configurar simulado',
    subtitle: selectedPack ? selectedPack.name : 'Personalize seu treino',
    content: `
      ${stackHeader('Configurar simulado', selectedPack ? selectedPack.name : 'Defina o conteúdo e o tempo')}
      <div class="dashboard-grid">
        ${card(`<form class="form-stack" data-form="simulation-config">
          <div class="field"><label for="simulation-pack">Concurso ou área</label><select class="select" id="simulation-pack" name="packId"><option value="">Banco completo</option>${packs.map((pack) => `<option value="${pack.id}" ${pack.id === params.packId ? 'selected' : ''}>${escapeHtml(pack.name)}</option>`).join('')}</select></div>
          <div class="form-grid">
            <div class="field"><label for="simulation-discipline">Disciplina</label><select class="select" id="simulation-discipline" name="discipline"><option value="">Todas</option>${disciplines.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="simulation-board">Banca</label><select class="select" id="simulation-board" name="board"><option value="">Todas</option>${boards.map((board) => `<option value="${escapeHtml(board)}">${escapeHtml(board)}</option>`).join('')}</select></div>
          </div>
          <div class="form-grid">
            <div class="field"><label for="simulation-difficulty">Dificuldade</label><select class="select" id="simulation-difficulty" name="difficulty"><option value="">Todas</option><option>Fácil</option><option>Média</option><option>Difícil</option></select></div>
            <div class="field"><label for="simulation-count">Quantidade</label><select class="select" id="simulation-count" name="questionCount">${[5, 10, 15, 20, 30].map((value) => `<option value="${value}">${value} questões</option>`).join('')}</select></div>
          </div>
          <div class="field"><label for="simulation-duration">Duração</label><select class="select" id="simulation-duration" name="durationMinutes">${[10, 20, 30, 45, 60, 90].map((value) => `<option value="${value}" ${value === 20 ? 'selected' : ''}>${value} minutos</option>`).join('')}</select></div>
          <label class="chip"><input type="checkbox" name="shuffleQuestions" checked /> Embaralhar questões</label>
          <p class="form-message" data-form-message>${questions.length} questões disponíveis antes dos filtros.</p>
          ${button('Iniciar simulado', { type: 'submit', size: 'lg', iconName: 'Play', className: 'full-width' })}
        </form>`, 'form-panel')}
        <aside class="dashboard-aside">
          ${card(`<div class="detail-panel"><p class="eyebrow">COMO FUNCIONA</p><h2>Você controla o ritmo</h2><ul class="benefit-list"><li>${icon('Check')}Tempo preservado se você atualizar a página</li><li>${icon('Check')}Navegação livre entre questões</li><li>${icon('Check')}Pausa, retomada e conclusão manual</li><li>${icon('Check')}Resultado detalhado ao final</li></ul></div>`)}
        </aside>
      </div>`,
  };
}

export function simulationPlayerView(state: SiteState): ViewModel {
  const session = state.simulations.current;
  if (!session || session.status === 'completed') {
    return { title: 'Simulado', content: `${stackHeader('Simulado')}${emptyState('Nenhum simulado em andamento', 'Configure um novo treino para começar.', { route: '/simulados/configurar', actionLabel: 'Montar simulado' })}` };
  }
  const { questions } = getCatalog();
  const index = clamp(session.currentIndex, 0, session.questionIds.length - 1);
  const question = questions.find((item) => item.id === session.questionIds[index]);
  if (!question) return { title: 'Simulado', content: emptyState('Questão indisponível', 'O catálogo foi atualizado. Inicie um novo simulado.', { action: 'discard-simulation', actionLabel: 'Descartar simulado' }) };
  const selected = session.answers[question.id];
  const answered = Object.keys(session.answers).length;
  const options = question.alternatives.map((alternative) => `<button class="option ${selected === alternative.id ? 'is-selected' : ''}" type="button" data-action="answer-simulation" data-question-id="${escapeHtml(question.id)}" data-alternative="${escapeHtml(alternative.id)}"><span class="option__letter">${escapeHtml(alternative.id)}</span><span>${escapeHtml(alternative.text)}</span></button>`).join('');
  const map = session.questionIds.map((id, mapIndex) => `<button type="button" data-action="go-simulation-question" data-index="${mapIndex}" class="${mapIndex === index ? 'is-active' : ''} ${session.answers[id] ? 'is-answered' : ''}">${mapIndex + 1}</button>`).join('');
  return {
    title: 'Simulado em andamento',
    subtitle: `${answered} de ${session.questionIds.length} respondidas`,
    content: `
      ${stackHeader('Simulado em andamento', `${answered} de ${session.questionIds.length} respondidas`)}
      <div class="toolbar">${badge(formatTimer(session.remainingSeconds), session.remainingSeconds < 300 ? 'danger' : 'accent', 'Clock3')}<div class="toolbar__group">${button(session.status === 'paused' ? 'Retomar' : 'Pausar', { action: session.status === 'paused' ? 'resume-simulation' : 'pause-simulation', variant: 'secondary', iconName: session.status === 'paused' ? 'Play' : 'Pause', size: 'sm' })}${button('Finalizar', { action: 'finish-simulation', variant: 'danger', size: 'sm' })}</div></div>
      ${progress(((index + 1) / session.questionIds.length) * 100, `Questão ${index + 1} de ${session.questionIds.length}`)}
      <div class="study-layout">
        ${card(`<div class="question-meta">${badge(question.board)}${badge(String(question.year))}${badge(question.difficulty, 'accent')}</div><p class="question-statement">${escapeHtml(question.statement)}</p><div class="options">${options}</div><div class="study-controls">${button('Anterior', { action: 'previous-simulation-question', variant: 'secondary', iconName: 'ArrowLeft', disabled: index === 0 })}${index === session.questionIds.length - 1 ? button('Revisar e finalizar', { action: 'finish-simulation', iconName: 'CheckCircle2' }) : button('Próxima', { action: 'next-simulation-question', iconName: 'ChevronRight' })}</div>`, 'question-card')}
        <aside class="study-side">${card(`<p class="eyebrow">NAVEGAÇÃO</p><h3>Mapa da prova</h3><div class="question-map">${map}</div><p class="muted">Você pode voltar a qualquer questão antes de finalizar.</p>`, 'detail-panel')}</aside>
      </div>`,
  };
}

export function simulationResultView(state: SiteState, requestedId?: string): ViewModel {
  const session = state.simulations.history.find((item) => item.id === requestedId)
    ?? (state.simulations.current?.status === 'completed' ? state.simulations.current : state.simulations.history[0]);
  if (!session) return { title: 'Resultado do simulado', content: `${stackHeader('Resultado')}${emptyState('Resultado não encontrado', 'Conclua um simulado para ver seu relatório.', { route: '/simulados', actionLabel: 'Ver simulados' })}` };
  const score = simulationScore(session);
  return {
    title: 'Resultado do simulado',
    subtitle: `${score.correct} acertos em ${score.total} questões`,
    content: `
      ${stackHeader('Resultado do simulado', new Intl.DateTimeFormat('pt-BR').format(new Date(session.completedAt ?? session.createdAt)))}
      ${card(`<div class="result-hero"><div class="result-hero__copy"><p class="eyebrow">DESEMPENHO</p><h2>${score.accuracy >= 80 ? 'Excelente resultado!' : score.accuracy >= 60 ? 'Você está no caminho.' : 'Este resultado mostra onde avançar.'}</h2><p>${score.correct} acertos, ${score.wrong} erros e ${score.blank} questões em branco.</p><div class="welcome__actions">${button('Novo simulado', { route: '/simulados/configurar', iconName: 'RotateCcw' })}${button('Voltar aos simulados', { route: '/simulados', variant: 'secondary' })}</div></div>${metricRing(score.accuracy, 'de acerto')}</div>`)}
      <section class="home-metrics page-metrics" aria-label="Resumo do resultado">${stat(String(score.correct), 'Acertos', 'CheckCircle2', 'success')}${stat(String(score.wrong), 'Erros', 'XCircle', 'danger')}${stat(String(score.blank), 'Em branco', 'Circle')}${stat(formatPercent(score.accuracy), 'Aproveitamento', 'BarChart3')}</section>
      ${section('Revisão da prova', `<div class="dashboard-main result-list">${score.items.map((item, index) => `<button class="list-row result-row" type="button" data-action="open-question" data-question-id="${escapeHtml(item.question.id)}"><span class="list-row__icon">${icon(item.correct ? 'CheckCircle2' : item.selected ? 'XCircle' : 'Circle')}</span><span class="list-row__copy"><strong>Questão ${index + 1} · ${escapeHtml(item.question.topic)}</strong><span>${item.selected ? `Sua resposta: ${escapeHtml(item.selected)}` : 'Não respondida'} · Gabarito: ${escapeHtml(item.question.correct)}</span></span>${badge(item.correct ? 'Acertou' : 'Revisar', item.correct ? 'success' : 'warning')}${icon('ChevronRight')}</button>`).join('')}</div>`)}
    `,
  };
}
