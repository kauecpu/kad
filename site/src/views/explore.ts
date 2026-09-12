import { getCatalog } from '../data/catalog.ts';
import {
  escapeHtml,
  filterQuestions,
  formatCount,
  formatCurrency,
  formatDate,
  matchesPack,
  normalizeText,
  questionsPerformance,
  slugify,
  unique,
} from '../core/utils.ts';
import { avatar, badge, button, card, emptyState, icon, progress, section, stat, timelineStep, workspaceHero } from '../ui/components.ts';
import { stackHeader } from '../ui/layout.ts';
import { RANKING_PERIOD_LABELS, type RankingPeriod } from '../../../data/ranking.ts';
import { rankingInitials, type RankingEntry } from '../../../lib/ranking.ts';
import type { Concurso, ConcursoPack, Question, RankingUiState, SiteState, ViewModel } from '../types/domain.ts';

type ViewParams = Record<string, string | undefined>;

function contestCard(concurso: Concurso, state: SiteState): string {
  const saved = state.savedConcursos.includes(concurso.id);
  return card(`
    <div class="contest-card__heading"><span class="contest-mark">${escapeHtml(concurso.shortName)}</span><button class="icon-button" type="button" data-action="toggle-concurso" data-concurso-id="${escapeHtml(concurso.id)}" aria-label="${saved ? 'Remover concurso dos salvos' : 'Salvar concurso'}">${icon(saved ? 'BookmarkCheck' : 'Bookmark')}</button></div>
    <div><h3>${escapeHtml(concurso.title)}</h3><p class="contest-card__organ">${escapeHtml(concurso.organ)}</p></div>
    <div class="question-meta">${badge(concurso.status === 'aberto' ? 'Aberto' : concurso.status === 'previsto' ? 'Previsto' : 'Encerrado', concurso.status === 'aberto' ? 'success' : concurso.status === 'previsto' ? 'warning' : 'neutral')}${badge(concurso.board)}</div>
    <div class="contest-card__meta"><span class="mini-meta">${icon('MapPin')}${escapeHtml(concurso.state)}</span><span class="mini-meta">${icon('BriefcaseBusiness')}${concurso.vacancies.toLocaleString('pt-BR')} vagas</span><span class="mini-meta">${icon('WalletCards')}${formatCurrency(concurso.salaryMax)}</span><span class="mini-meta">${icon('CalendarDays')}${formatDate(concurso.examDate)}</span></div>
    <a class="contest-card__link" href="/concursos/${concurso.id}" data-route="/concursos/${concurso.id}"><span>Ver concurso</span>${icon('ArrowRight')}</a>
  `, 'contest-card');
}
export function concursosView(state: SiteState, params: ViewParams = {}, savedOnly = false): ViewModel {
  const { concursos } = getCatalog();
  const statuses = ['aberto', 'previsto', 'encerrado'];
  const regions = unique(concursos.map((item) => item.region));
  const query = normalizeText(params.q);
  const filtered = concursos.filter((concurso) => {
    if (savedOnly && !state.savedConcursos.includes(concurso.id)) return false;
    if (params.status && concurso.status !== params.status) return false;
    if (params.region && concurso.region !== params.region) return false;
    if (query && !normalizeText(`${concurso.title} ${concurso.organ} ${concurso.board} ${concurso.state} ${concurso.roles.map((role) => role.name).join(' ')}`).includes(query)) return false;
    return true;
  });
  const title = savedOnly ? 'Meus concursos' : 'Concursos';
  return {
    title,
    subtitle: savedOnly ? formatCount(filtered.length, 'concurso acompanhado', 'concursos acompanhados') : 'Editais, prazos e oportunidades para sua meta',
    content: `
      ${savedOnly ? stackHeader(title, formatCount(filtered.length, 'concurso salvo', 'concursos salvos')) : workspaceHero({
        id: 'contests-overview',
        eyebrow: 'FOCO DA META',
        title: 'Encontre o concurso que combina com seu próximo passo.',
        description: 'Compare vagas, salários, datas e comece a estudar pelas questões relacionadas.',
        actions: button('Ver concursos salvos', { route: '/concursos/salvos', iconName: 'Bookmark' }),
      })}
      <form class="filter-bar filter-panel filter-panel--contest" data-form="contest-search">
        <div class="field"><label for="contest-q">Buscar concurso</label><input class="input" id="contest-q" name="q" value="${escapeHtml(params.q ?? '')}" placeholder="Órgão, banca, cargo ou estado" /></div>
        <div class="field"><label for="contest-status">Situação</label><select class="select" id="contest-status" name="status"><option value="">Todas as situações</option>${statuses.map((status) => `<option value="${status}" ${params.status === status ? 'selected' : ''}>${status[0].toUpperCase()}${status.slice(1)}</option>`).join('')}</select></div>
        <div class="field"><label for="contest-region">Região</label><select class="select" id="contest-region" name="region"><option value="">Todas as regiões</option>${regions.map((region) => `<option value="${escapeHtml(region)}" ${params.region === region ? 'selected' : ''}>${escapeHtml(region)}</option>`).join('')}</select></div>
        <input type="hidden" name="savedOnly" value="${savedOnly ? '1' : ''}" />
        ${button('Filtrar', { type: 'submit', iconName: 'Filter' })}
      </form>
      <div class="toolbar"><div><p class="eyebrow">OPORTUNIDADES</p><h2>${formatCount(filtered.length, 'concurso', 'concursos')}</h2></div>${!savedOnly ? button('Meus concursos', { route: '/concursos/salvos', variant: 'secondary', iconName: 'Bookmark' }) : ''}</div>
      ${filtered.length ? `<div class="contest-grid">${filtered.map((concurso) => contestCard(concurso, state)).join('')}</div>` : emptyState(savedOnly ? 'Nenhum concurso salvo' : 'Nenhum concurso encontrado', savedOnly ? 'Salve oportunidades para acompanhar tudo em um só lugar.' : 'Tente remover um filtro ou pesquisar por outro termo.', { route: '/concursos', actionLabel: 'Explorar concursos' })}
    `,
  };
}

function packForConcurso(concurso: Concurso, packs: ConcursoPack[]): ConcursoPack | undefined {
  return packs.find((pack) => {
    const text = normalizeText(`${concurso.organ} ${concurso.title} ${concurso.roles.map((role) => role.name).join(' ')}`);
    return [...pack.goalKeywords, pack.name].some((term) => text.includes(normalizeText(term)) || normalizeText(term).includes(normalizeText(concurso.shortName)));
  });
}

export function concursoDetailView(id: string, state: SiteState): ViewModel {
  const { concursos, packs, questions } = getCatalog();
  const concurso = concursos.find((item) => item.id === id);
  if (!concurso) return { title: 'Concurso', content: `${stackHeader('Concurso')}${emptyState('Concurso não encontrado', 'O catálogo pode ter sido atualizado.', { route: '/concursos', actionLabel: 'Ver concursos' })}` };
  const saved = state.savedConcursos.includes(concurso.id);
  const pack = packForConcurso(concurso, packs);
  const packQuestions = pack ? questions.filter((question) => matchesPack(question, pack)) : [];
  return {
    title: concurso.shortName,
    subtitle: concurso.organ,
    content: `
      ${stackHeader(concurso.shortName, concurso.organ)}
      <div class="contest-detail">
        <div class="dashboard-main">
          ${card(`<div class="detail-panel"><div class="contest-card__heading"><span class="contest-mark">${escapeHtml(concurso.shortName)}</span>${badge(concurso.status === 'aberto' ? 'Inscrições abertas' : concurso.status === 'previsto' ? 'Previsto' : 'Encerrado', concurso.status === 'aberto' ? 'success' : 'warning')}</div><div><h2>${escapeHtml(concurso.title)}</h2><p class="muted">${escapeHtml(concurso.organ)} · ${escapeHtml(concurso.state)}</p></div><div class="summary-grid">${stat(String(concurso.vacancies), 'Vagas', 'BriefcaseBusiness')}${stat(formatCurrency(concurso.salaryMax), 'Salário até', 'WalletCards', 'success')}${stat(concurso.board, 'Banca', 'Building2')}${stat(formatDate(concurso.examDate), 'Prova', 'CalendarDays', 'warning')}</div><div class="welcome__actions">${button(saved ? 'Concurso salvo' : 'Salvar concurso', { action: 'toggle-concurso', iconName: saved ? 'BookmarkCheck' : 'Bookmark', attrs: `data-concurso-id="${escapeHtml(concurso.id)}"` })}${concurso.editalUrl?.startsWith('https://') ? `<a class="button button--secondary" href="${escapeHtml(concurso.editalUrl)}" target="_blank" rel="noopener noreferrer">${icon('ExternalLink')}<span>Página oficial</span></a>` : ''}</div></div>`)}
          ${section('Cargos e vagas', card(`<div class="list">${concurso.roles.map((role) => `<div class="list-row"><span class="list-row__icon">${icon('BriefcaseBusiness')}</span><span class="list-row__copy"><strong>${escapeHtml(role.name)}</strong><span>${role.level} · ${role.vacancies} vagas</span></span><strong>${formatCurrency(role.salary)}</strong></div>`).join('')}</div>`))}
          ${section('Destaques', card(`<div class="detail-panel"><ul class="benefit-list">${concurso.highlights.map((item) => `<li>${icon('CheckCircle2')}${escapeHtml(item)}</li>`).join('')}</ul></div>`))}
        </div>
        <aside class="dashboard-aside">
          ${card(`<div class="detail-panel"><p class="eyebrow">CRONOGRAMA</p><div class="detail-list"><div class="detail-row"><span>Início das inscrições</span><strong>${formatDate(concurso.registrationStart)}</strong></div><div class="detail-row"><span>Fim das inscrições</span><strong>${formatDate(concurso.registrationEnd)}</strong></div><div class="detail-row"><span>Data da prova</span><strong>${formatDate(concurso.examDate)}</strong></div><div class="detail-row"><span>Taxa</span><strong>${concurso.fee ? formatCurrency(concurso.fee) : 'A definir'}</strong></div></div></div>`)}
          ${card(`<div class="detail-panel"><p class="eyebrow">ESTUDAR</p><h2>${pack ? escapeHtml(pack.name) : 'Conteúdo em preparação'}</h2><p class="muted">${pack ? `${formatCount(packQuestions.length, 'questão relacionada', 'questões relacionadas')} ao escopo deste concurso.` : 'Ainda não há um pacote de questões ligado a este edital.'}</p>${pack && packQuestions.length ? button('Estudar para este concurso', { route: `/questoes/sessao?packId=${pack.id}`, iconName: 'Play', className: 'full-width' }) : ''}</div>`)}
        </aside>
      </div>`,
  };
}

function rankingRow(entry: RankingEntry): string {
  const identity = entry.username ? `@${entry.username} · nível ${entry.level}` : `Nível ${entry.level}`;
  return `<div class="ranking-row" role="listitem" aria-label="${entry.rank}º lugar, ${escapeHtml(entry.name)}, ${entry.points.toLocaleString('pt-BR')} XP, nível ${entry.level}">
    <strong class="ranking-row__rank">#${entry.rank}</strong>
    <span class="ranking-row__avatar ranking-row__avatar--${entry.rank <= 3 ? 'podium' : 'default'}" aria-hidden="true">${escapeHtml(rankingInitials(entry.name))}</span>
    <span class="ranking-row__identity"><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(identity)}</small></span>
    <span class="ranking-row__activity">${formatCount(entry.activityCount, 'atividade válida', 'atividades válidas')}</span>
    <span class="ranking-row__score"><strong>${entry.points.toLocaleString('pt-BR')}</strong><small>XP</small></span>
  </div>`;
}

export function rankingView(state: SiteState, params: ViewParams = {}, ranking: RankingUiState): ViewModel {
  const period: RankingPeriod = params.period === 'month' || params.period === 'all' ? params.period : 'today';
  const periodOptions: [RankingPeriod, string][] = [['today', 'Hoje'], ['month', 'Mês'], ['all', 'Geral']];
  const periodControl = `<div class="ranking-period" aria-label="Período do ranking"><span class="eyebrow">PERÍODO</span><div class="segmented" role="group">${periodOptions.map(([value, label]) => `<button type="button" data-action="ranking-period" data-period="${value}" class="${period === value ? 'is-active' : ''}" aria-pressed="${period === value}">${label}</button>`).join('')}</div></div>`;

  if (state.auth.mode !== 'authenticated') {
    return {
      title: 'Ranking',
      subtitle: 'XP confirmado pelo estudo',
      content: `<div class="ranking-workspace">${periodControl}${emptyState('Entre para participar', 'O ranking usa apenas XP confirmado na sua conta.', { route: '/entrar', actionLabel: 'Entrar na conta', iconName: 'UserRound' })}</div>`,
    };
  }

  if (ranking.status === 'loading' || ranking.status === 'idle') {
    return {
      title: 'Ranking',
      subtitle: 'XP confirmado pelo estudo',
      content: `<div class="ranking-workspace">${periodControl}<section class="ranking-status" role="status" aria-live="polite" aria-busy="true"><span class="level-spinner" aria-hidden="true"></span><p>Carregando classificação…</p></section></div>`,
    };
  }

  if (ranking.status === 'error' && !ranking.snapshot) {
    return {
      title: 'Ranking',
      subtitle: 'XP confirmado pelo estudo',
      content: `<div class="ranking-workspace">${periodControl}<section class="ranking-status ranking-status--error" role="alert"><span class="level-status-icon">${icon('CloudOff')}</span><div><h2>Não foi possível carregar o ranking agora.</h2><p>${escapeHtml(ranking.error || 'Seu estudo continua salvo. Tente novamente em instantes.')}</p></div>${button('Tentar novamente', { action: 'retry-ranking', variant: 'secondary', iconName: 'RotateCcw' })}</section></div>`,
    };
  }

  const snapshot = ranking.snapshot;
  if (!snapshot) {
    return {
      title: 'Ranking',
      subtitle: 'XP confirmado pelo estudo',
      content: `<div class="ranking-workspace">${periodControl}${emptyState('Ranking começando', 'Ainda não há classificação disponível neste período.', { route: '/questoes', actionLabel: 'Responder questões', iconName: 'Trophy' })}</div>`,
    };
  }

  const current = snapshot.currentUser;
  return {
    title: 'Ranking',
    subtitle: 'XP confirmado pelo estudo',
    content: `<div class="ranking-workspace">
      ${periodControl}
      <button class="ranking-privacy" type="button" data-route="/configuracoes"><span class="ranking-privacy__icon">${icon('ShieldCheck')}</span><span><strong>Privacidade do ranking</strong><small>Sua participação pública é controlada nas Configurações.</small></span>${icon('ArrowRight')}</button>
      ${ranking.status === 'error' ? `<p class="ranking-inline-error" role="alert">${escapeHtml(ranking.error)}</p>` : ''}
      ${current ? `<section class="ranking-position" aria-label="Sua posição ${RANKING_PERIOD_LABELS[period]}: ${current.rank}, com ${current.points} XP"><span class="ranking-position__icon">${icon('Trophy')}</span><div><p class="eyebrow">SUA POSIÇÃO ${RANKING_PERIOD_LABELS[period].toLocaleUpperCase('pt-BR')}</p><h2>#${current.rank} · ${escapeHtml(current.name)}</h2><p>${current.isPublic ? 'Posição pública' : 'Posição estimada e privada'} · nível ${current.level} · ${formatCount(current.activityCount, 'atividade válida', 'atividades válidas')}</p></div><span class="ranking-position__score"><strong>${current.points.toLocaleString('pt-BR')}</strong><small>XP</small></span></section>` : ''}
      <section class="ranking-classification" aria-labelledby="ranking-list-title">
        <header><div><p class="eyebrow">CLASSIFICAÇÃO</p><h2 id="ranking-list-title">Destaques ${RANKING_PERIOD_LABELS[period]}</h2></div><span>${formatCount(snapshot.totalParticipants, 'participante', 'participantes')}</span></header>
        ${snapshot.entries.length ? `<div class="ranking-list" role="list">${snapshot.entries.map(rankingRow).join('')}</div>` : emptyState('Ranking começando', 'Ainda não há participantes públicos neste período.', { route: '/questoes', actionLabel: 'Responder questões', iconName: 'Trophy' })}
      </section>
    </div>`,
  };
}

function trailChunks(questions: Question[]): Question[][] {
  const sorted = [...questions].sort((left, right) =>
    (left.difficulty ? { Fácil: 0, Média: 1, Difícil: 2 }[left.difficulty] : Number.POSITIVE_INFINITY) -
    (right.difficulty ? { Fácil: 0, Média: 1, Difícil: 2 }[right.difficulty] : Number.POSITIVE_INFINITY)
  );
  const active = Math.min(10, sorted.length);
  const chunks: Question[][] = Array.from({ length: 10 }, () => []);
  sorted.forEach((question, index) => chunks[Math.min(active - 1, Math.floor((index * active) / sorted.length))].push(question));
  return chunks;
}

export function trailsView(state: SiteState, params: ViewParams = {}): ViewModel {
  const { disciplines, packs, questions } = getCatalog();
  const mode = params.mode === 'disciplina' ? 'disciplina' : 'concurso';
  const selectedId = params.track ?? (mode === 'concurso' ? packs[0]?.id : slugify(disciplines[0]?.name));
  const selectedPack = mode === 'concurso' ? packs.find((pack) => pack.id === selectedId) : null;
  const selectedDiscipline = mode === 'disciplina' ? disciplines.find((item) => slugify(item.name) === selectedId) : null;
  const trackQuestions = selectedPack
    ? questions.filter((question) => matchesPack(question, selectedPack))
    : selectedDiscipline
      ? questions.filter((question) => question.discipline === selectedDiscipline.name)
      : [];
  const chunks = trailChunks(trackQuestions);
  const answeredIds = new Set(Object.keys(state.answers));
  let priorComplete = true;
  let nextRoute = '';
  const levels = chunks.map((chunk, index) => {
    const answered = chunk.filter((question) => answeredIds.has(question.id)).length;
    const complete = chunk.length > 0 && answered === chunk.length;
    const unlocked = index === 0 || priorComplete;
    priorComplete = priorComplete && complete;
    const query = selectedPack
      ? `packId=${selectedPack.id}`
      : `discipline=${encodeURIComponent(selectedDiscipline?.name ?? '')}`;
    const offset = chunks.slice(0, index).reduce((sum, current) => sum + current.length, 0);
    const route = chunk.length && unlocked ? `/questoes/sessao?${query}&offset=${offset}&limit=${chunk.length}` : '';
    if (!nextRoute && route && !complete) nextRoute = route;
    return timelineStep({
      index: index + 1,
      title: ['Iniciante', 'Primeiros conceitos', 'Fundamentos', 'Base prática', 'Intermediário', 'Consolidação', 'Aplicação', 'Desafios', 'Revisão avançada', 'Avançado'][index],
      description: chunk.length ? `${answered} de ${formatCount(chunk.length, 'questão', 'questões')}` : 'Conteúdo em preparação',
      state: complete ? 'complete' : unlocked && chunk.length ? 'current' : 'locked',
      route,
    });
  }).join('');
  const tracks = mode === 'concurso' ? packs.map((item) => [item.id, item.name]) : disciplines.map((item) => [slugify(item.name), item.name]);
  return {
    title: 'Trilhas de estudo',
    subtitle: 'Avance do fundamento ao nível de prova',
    content: `<div class="study-journey">
      <header class="journey-intro" aria-labelledby="trails-overview">
        <div><p class="eyebrow">TRILHA ATUAL</p><h2 id="trails-overview">${escapeHtml(selectedPack?.name ?? selectedDiscipline?.name ?? 'Escolha sua trilha')}</h2><p>${formatCount(trackQuestions.length, 'questão distribuída', 'questões distribuídas')} em uma sequência progressiva, sem repetição.</p></div>
        ${nextRoute ? button('Continuar próxima etapa', { route: nextRoute, iconName: 'Play' }) : ''}
      </header>
      <div class="journey-controls"><div class="segmented"><button type="button" data-action="trail-mode" data-mode="concurso" class="${mode === 'concurso' ? 'is-active' : ''}">Por concurso</button><button type="button" data-action="trail-mode" data-mode="disciplina" class="${mode === 'disciplina' ? 'is-active' : ''}">Por disciplina</button></div><select class="select" data-action="trail-track" aria-label="Escolher trilha">${tracks.map(([id, label]) => `<option value="${escapeHtml(id)}" ${selectedId === id ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div>
      ${section('Seu percurso', `<div class="study-timeline">${levels}</div>`, { eyebrow: mode === 'concurso' ? 'CONCURSO OU ÁREA' : 'DISCIPLINA' })}
    </div>`,
  };
}
