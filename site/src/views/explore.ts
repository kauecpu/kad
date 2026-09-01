import { getCatalog } from '../data/catalog.ts';
import {
  escapeHtml,
  filterQuestions,
  formatCount,
  formatCurrency,
  formatDate,
  formatPercent,
  matchesPack,
  normalizeText,
  questionsPerformance,
  slugify,
  unique,
} from '../core/utils.ts';
import { avatar, badge, button, card, emptyState, icon, progress, section, stat, workspaceHero } from '../ui/components.ts';
import { stackHeader } from '../ui/layout.ts';
import type { Concurso, ConcursoPack, Question, SiteState, ViewModel } from '../types/domain.ts';

type ViewParams = Record<string, string | undefined>;
type RankingPeriod = 'today' | 'month' | 'all';
type LocalRankingScore = { points: number; correct: number; accuracy: number };

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

function localRankingScore(state: SiteState, questions: Question[], period: RankingPeriod, pack?: ConcursoPack): LocalRankingScore {
  const now = new Date();
  const records = Object.values(state.answers).filter((answer) => {
    const date = new Date(answer.answeredAt);
    if (period === 'today' && date.toDateString() !== now.toDateString()) return false;
    if (period === 'month' && (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear())) return false;
    const question = questions.find((item) => item.id === answer.questionId);
    return !pack || matchesPack(question, pack);
  });
  const points = records.reduce((sum, answer) => {
    if (!answer.isCorrect) return sum;
    const question = questions.find((item) => item.id === answer.questionId);
    return sum + (question?.difficulty ? { Fácil: 1, Média: 2, Difícil: 3 }[question.difficulty] : 1);
  }, 0);
  const correct = records.filter((answer) => answer.isCorrect).length;
  return { points, correct, accuracy: records.length ? (correct / records.length) * 100 : 0 };
}

export function rankingView(state: SiteState, params: ViewParams = {}): ViewModel {
  const { questions, packs, rankingParticipants } = getCatalog();
  const requestedPeriod = params.period;
  const period: RankingPeriod = requestedPeriod === 'today' || requestedPeriod === 'all' ? requestedPeriod : 'month';
  const pack = packs.find((item) => item.id === params.packId);
  const local = localRankingScore(state, questions, period, pack);
  const factor = period === 'today' ? 0.07 : period === 'month' ? 1 : 6.5;
  const entries = rankingParticipants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    username: participant.username,
    points: Math.round(participant.basePoints.month * factor * (pack ? (participant.specialties.includes(pack.id) ? 0.56 : 0.22) : 1)),
    accuracy: participant.accuracy,
    streak: participant.streak,
    current: false,
  }));
  entries.push({ id: 'current-user', name: state.profile.name, username: state.profile.username || '@voce', points: local.points, accuracy: local.accuracy, streak: 1, current: true });
  entries.sort((left, right) => right.points - left.points || right.accuracy - left.accuracy);
  const ranked = entries.map((item, index) => ({ ...item, rank: index + 1 }));
  const podium = ranked.slice(0, 3);
  return {
    title: 'Ranking',
    subtitle: 'Sua constância também merece destaque',
    content: `
      ${workspaceHero({
        id: 'ranking-overview',
        eyebrow: 'RANKING KAD · DEMONSTRAÇÃO',
        title: 'Suba no ranking estudando com consistência.',
        description: 'Os participantes exibidos são demonstrativos. Seus próprios pontos são calculados a partir da atividade salva neste ambiente.',
        actions: `${badge('Dados demonstrativos', 'warning', 'Info')}${button('Responder questões', { route: '/questoes', iconName: 'TrendingUp' })}`,
      })}
      <div class="toolbar"><div class="segmented" aria-label="Período do ranking">${[['today', 'Hoje'], ['month', 'Este mês'], ['all', 'Geral']].map(([value, label]) => `<button type="button" data-action="ranking-period" data-period="${value}" class="${period === value ? 'is-active' : ''}">${label}</button>`).join('')}</div><select class="select" style="width:auto" data-action="ranking-pack" aria-label="Filtrar ranking por concurso"><option value="">Todos os concursos</option>${packs.map((item) => `<option value="${item.id}" ${pack?.id === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
      <div class="podium">${podium.map((entry, index) => `<div class="podium-card ${index === 0 ? 'podium-card--first' : ''}">${avatar(entry.name, index === 0 ? 'md' : 'sm')}<strong>${escapeHtml(entry.name)}</strong><span>${escapeHtml(entry.username)}</span><b>${entry.points} pts</b>${badge(`#${entry.rank}`, index === 0 ? 'warning' : 'neutral')}</div>`).join('')}</div>
      ${card(`<table class="ranking-table"><thead><tr><th>Posição</th><th>Candidato</th><th>Sequência</th><th>Acerto</th><th>Pontos</th></tr></thead><tbody>${ranked.map((entry) => `<tr class="${entry.current ? 'is-current' : ''}"><td><strong>#${entry.rank}</strong></td><td><div class="rank-user">${avatar(entry.name, 'sm')}<span><strong>${escapeHtml(entry.name)}</strong><br /><span class="subtle">${escapeHtml(entry.username)}</span></span></div></td><td>${entry.streak} dias</td><td>${formatPercent(entry.accuracy)}</td><td><strong>${entry.points}</strong></td></tr>`).join('')}</tbody></table>`, 'table-panel')}
    `,
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
  const levels = chunks.map((chunk, index) => {
    const answered = chunk.filter((question) => answeredIds.has(question.id)).length;
    const complete = chunk.length > 0 && answered === chunk.length;
    const unlocked = index === 0 || priorComplete;
    priorComplete = priorComplete && complete;
    const query = selectedPack
      ? `packId=${selectedPack.id}`
      : `discipline=${encodeURIComponent(selectedDiscipline?.name ?? '')}`;
    const offset = chunks.slice(0, index).reduce((sum, current) => sum + current.length, 0);
    return card(`<span class="trail-level__number">${index + 1}</span><span><h3>${['Iniciante', 'Primeiros conceitos', 'Fundamentos', 'Base prática', 'Intermediário', 'Consolidação', 'Aplicação', 'Desafios', 'Revisão avançada', 'Avançado'][index]}</h3><p>${chunk.length ? `${answered} de ${formatCount(chunk.length, 'questão', 'questões')}` : 'Conteúdo em preparação'}</p></span>${chunk.length && unlocked ? button(complete ? 'Revisar' : answered ? 'Continuar' : 'Começar', { route: `/questoes/sessao?${query}&offset=${offset}&limit=${chunk.length}`, variant: complete ? 'secondary' : 'primary', size: 'sm' }) : badge(chunk.length ? 'Bloqueado' : 'Em breve')}`, `trail-level ${!unlocked ? 'is-locked' : ''}`);
  }).join('');
  const tracks = mode === 'concurso' ? packs.map((item) => [item.id, item.name]) : disciplines.map((item) => [slugify(item.name), item.name]);
  return {
    title: 'Trilhas de estudo',
    subtitle: 'Avance do fundamento ao nível de prova',
    content: `
      ${workspaceHero({
        id: 'trails-overview',
        eyebrow: 'TRILHA ATUAL',
        title: selectedPack?.name ?? selectedDiscipline?.name ?? 'Escolha sua trilha',
        description: `${formatCount(trackQuestions.length, 'questão distribuída', 'questões distribuídas')} em até dez níveis, sem repetição.`,
        actions: trackQuestions.length ? button('Começar próximo nível', { route: levels ? `/questoes/sessao?${selectedPack ? `packId=${selectedPack.id}` : `discipline=${encodeURIComponent(selectedDiscipline?.name ?? '')}`}&limit=${chunks.find((chunk) => chunk.length)?.length ?? 1}` : '/questoes', iconName: 'Play' }) : '',
      })}
      <div class="toolbar"><div class="segmented"><button type="button" data-action="trail-mode" data-mode="concurso" class="${mode === 'concurso' ? 'is-active' : ''}">Por concurso</button><button type="button" data-action="trail-mode" data-mode="disciplina" class="${mode === 'disciplina' ? 'is-active' : ''}">Por disciplina</button></div><select class="select" style="width:auto;max-width:300px" data-action="trail-track" aria-label="Escolher trilha">${tracks.map(([id, label]) => `<option value="${escapeHtml(id)}" ${selectedId === id ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div>
      ${section('Níveis disponíveis', `<div class="trail-levels">${levels}</div>`, { eyebrow: mode === 'concurso' ? 'CONCURSO OU ÁREA' : 'DISCIPLINA' })}
    `,
  };
}
