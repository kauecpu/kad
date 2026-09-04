import { getCatalog } from '../data/catalog.ts';
import {
  clamp,
  escapeHtml,
  filterQuestions,
  formatCount,
  formatPercent,
  normalizeText,
  questionsPerformance,
  slugify,
  unique,
} from '../core/utils.ts';
import { badge, button, card, emptyState, icon, progress, section, subjectIndexRow } from '../ui/components.ts';
import { stackHeader } from '../ui/layout.ts';
import type { Question, SiteState, UiState, ViewModel } from '../types/domain.ts';

type ViewParams = Record<string, string | undefined>;
type AnswerStatus = 'unanswered' | 'correct' | 'wrong' | 'favorites' | undefined;
type QuestionUiState = Pick<UiState, 'questionIndex' | 'visitedQuestionIds' | 'studySyncMessage' | 'studyReady'>;
const sessions = new WeakMap<QuestionUiState, { key: string; catalog: Question[]; questions: Question[] }>();
export function resetQuestionSession(ui: QuestionUiState): void { sessions.delete(ui); }

function sessionQuestions(state: SiteState, params: ViewParams, ui: QuestionUiState): Question[] {
  const key = JSON.stringify(params);
  const catalog = getCatalog().questions;
  const existing = sessions.get(ui);
  if (existing?.key === key && existing.catalog === catalog) return existing.questions;
  const questions = questionsForSession(params, state);
  sessions.set(ui, { key, catalog, questions });
  return questions;
}

function questionResultCard(question: Question, state: SiteState): string {
  const answer = state.answers[question.id];
  return `<button class="list-row result-row" type="button" data-action="open-question" data-question-id="${escapeHtml(question.id)}">
      <span class="list-row__icon">${icon(answer ? (answer.isCorrect ? 'CheckCircle2' : 'XCircle') : 'BookOpen')}</span>
      <span class="list-row__copy"><strong>${escapeHtml(question.topic)}</strong><span>${escapeHtml(question.discipline)} · ${escapeHtml(question.board)} · ${question.year}</span></span>
      ${answer ? badge(answer.isCorrect ? 'Acertada' : 'Errada', answer.isCorrect ? 'success' : 'danger') : badge(question.difficulty)}
      ${icon('ChevronRight')}
    </button>`;
}

export function questionsIndexView(state: SiteState): ViewModel {
  const { disciplines, questions } = getCatalog();
  const performance = questionsPerformance(state.answers);
  const disciplineRows = disciplines.map((discipline, index) => {
    const available = questions.filter((question) => question.discipline === discipline.name);
    const answered = available.filter((question) => state.answers[question.id]).length;
    return subjectIndexRow({
      abbreviation: discipline.name.slice(0, 2).toUpperCase(),
      title: discipline.name,
      description: `${formatCount(available.length, 'questão', 'questões')} · ${formatCount(answered, 'respondida', 'respondidas')}`,
      route: `/questoes/disciplina/${slugify(discipline.name)}`,
      tone: index === 0 && answered ? 'info' : 'primary',
    });
  }).join('');

  return {
    title: 'Questões',
    subtitle: `${formatCount(questions.length, 'questão disponível', 'questões disponíveis')} para praticar`,
    content: `<div class="study-catalog">
      <header class="catalog-intro" aria-labelledby="questions-overview">
        <div><p class="eyebrow">BANCO DE QUESTÕES</p><h2 id="questions-overview">Encontre uma matéria e comece.</h2><p>Continue pelo seu histórico ou escolha uma disciplina. Filtros avançados ficam disponíveis quando você precisar.</p></div>
        <div class="catalog-intro__actions">${button('Procurar questões', { route: '/questoes/buscar', iconName: 'Search' })}${button('Desafio rápido', { route: '/questoes/desafio', variant: 'secondary', iconName: 'Zap' })}</div>
      </header>

      ${performance.total ? `<aside class="catalog-progress" aria-label="Seu progresso nas questões"><div><p class="eyebrow">CONTINUAR</p><strong>${formatCount(performance.total, 'questão respondida', 'questões respondidas')}</strong><span>${formatPercent(performance.accuracy)} de acerto até agora</span></div>${button('Revisar erros', { route: '/questoes/revisar?tipo=erradas', variant: 'ghost', iconName: 'RotateCcw' })}</aside>` : ''}

      ${section('Matérias', `<div class="subject-index">${disciplineRows}</div>`, {
        eyebrow: 'ESCOLHA ONDE PRATICAR',
        action: button('Ver todos os filtros', { route: '/questoes/buscar', variant: 'ghost', size: 'sm', iconName: 'SlidersHorizontal' }),
      })}

      <nav class="review-rail" aria-label="Atalhos de revisão">
        <span><strong>Revisar</strong><small>Use seu histórico para decidir o próximo estudo.</small></span>
        <button type="button" data-route="/questoes/revisar?tipo=favoritas">${icon('Bookmark')}Favoritas <strong>${state.favorites.length}</strong></button>
        <button type="button" data-route="/questoes/revisar?tipo=erradas">${icon('RotateCcw')}Erradas <strong>${performance.wrong}</strong></button>
        <button type="button" data-route="/concursos">${icon('Building2')}Por concurso</button>
      </nav>
    </div>`,
  };
}

export function disciplineView(slug: string, state: SiteState): ViewModel {
  const { disciplines, questions } = getCatalog();
  const discipline = disciplines.find((item) => slugify(item.name) === slug);
  if (!discipline) {
    return { title: 'Disciplina', content: `${stackHeader('Disciplina')}${emptyState('Disciplina não encontrada', 'Volte ao catálogo e escolha outra disciplina.', { route: '/questoes', actionLabel: 'Ver disciplinas' })}` };
  }
  const available = questions.filter((question) => question.discipline === discipline.name);
  const topicRows = discipline.topics.map((topic) => {
    const topicQuestions = available.filter((question) => question.topic === topic);
    const answered = topicQuestions.filter((question) => state.answers[question.id]).length;
    return `<button class="list-row" type="button" data-route="/questoes/sessao?discipline=${encodeURIComponent(discipline.name)}&topic=${encodeURIComponent(topic)}"><span class="list-row__icon">${icon('ListChecks')}</span><span class="list-row__copy"><strong>${escapeHtml(topic)}</strong><span>${formatCount(topicQuestions.length, 'questão', 'questões')} · ${formatCount(answered, 'respondida', 'respondidas')}</span></span>${badge(String(topicQuestions.length), topicQuestions.length ? 'accent' : 'neutral')}${icon('ChevronRight')}</button>`;
  }).join('');
  return {
    title: discipline.name,
    subtitle: `${formatCount(available.length, 'questão', 'questões')} em ${formatCount(discipline.topics.length, 'assunto', 'assuntos')}`,
    content: `
      ${stackHeader(discipline.name, formatCount(available.length, 'questão', 'questões'))}
      ${card(`<div class="detail-panel"><div><p class="eyebrow">SESSÃO GERAL</p><h2>Praticar todos os assuntos</h2></div><p class="muted">Misture as questões disponíveis desta disciplina em uma única sessão.</p>${button('Começar sessão', { route: `/questoes/sessao?discipline=${encodeURIComponent(discipline.name)}`, iconName: 'Play' })}</div>`)}
      ${section('Escolha um assunto', `<div class="result-list">${topicRows}</div>`)}
    `,
  };
}

function applyAnswerStatus(questions: Question[], state: SiteState, status: AnswerStatus | string): Question[] {
  if (status === 'unanswered') return questions.filter((question) => !state.answers[question.id]);
  if (status === 'correct') return questions.filter((question) => state.answers[question.id]?.isCorrect);
  if (status === 'wrong') return questions.filter((question) => state.answers[question.id] && !state.answers[question.id].isCorrect);
  if (status === 'favorites') return questions.filter((question) => state.favorites.includes(question.id));
  return questions;
}

export function searchView(state: SiteState, params: ViewParams = {}): ViewModel {
  const { questions, disciplines } = getCatalog();
  const boards = unique(questions.map((question) => question.board)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filtered = applyAnswerStatus(filterQuestions(questions, params), state, params.status);
  const hasSearch = Object.values(params).some(Boolean);
  const serializedParams = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  return {
    title: 'Procurar questões',
    subtitle: 'Combine filtros para montar sua prática',
    content: `
      ${stackHeader('Procurar questões', 'Use um ou mais filtros')}
      <form class="question-search-panel" data-form="question-search">
        <div class="question-search-panel__primary">
          <div class="field"><label for="question-keyword">Palavra-chave</label><input class="input" id="question-keyword" name="keyword" value="${escapeHtml(params.keyword ?? '')}" placeholder="Enunciado, assunto, banca ou cargo" /></div>
          <div class="field"><label for="question-discipline">Disciplina</label><select class="select" id="question-discipline" name="discipline"><option value="">Todas as disciplinas</option>${disciplines.map((item) => `<option value="${escapeHtml(item.name)}" ${params.discipline === item.name ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
          ${button('Buscar', { type: 'submit', iconName: 'Search' })}
        </div>
        <details class="filter-disclosure" ${params.board || params.status ? 'open' : ''}>
          <summary>${icon('SlidersHorizontal')}<span>Mais filtros</span>${params.board || params.status ? badge('Ativos', 'accent') : ''}${icon('ChevronDown')}</summary>
          <div class="question-search-panel__advanced">
            <div class="field"><label for="question-board">Banca</label><select class="select" id="question-board" name="board"><option value="">Todas as bancas</option>${boards.map((item) => `<option value="${escapeHtml(item)}" ${params.board === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></div>
            <div class="field"><label for="question-status">Situação</label><select class="select" id="question-status" name="status"><option value="">Qualquer situação</option><option value="unanswered" ${params.status === 'unanswered' ? 'selected' : ''}>Não respondidas</option><option value="correct" ${params.status === 'correct' ? 'selected' : ''}>Acertadas</option><option value="wrong" ${params.status === 'wrong' ? 'selected' : ''}>Erradas</option></select></div>
          </div>
        </details>
      </form>
      <div class="toolbar"><div><p class="eyebrow">RESULTADOS</p><h2>${formatCount(filtered.length, 'questão', 'questões')}</h2></div>${filtered.length ? button('Estudar resultados', { action: 'study-search-results', iconName: 'Play', attrs: `data-search="${escapeHtml(serializedParams.toString())}"` }) : ''}</div>
      ${filtered.length ? `<div class="dashboard-main result-list">${filtered.slice(0, 40).map((question) => questionResultCard(question, state)).join('')}</div>` : emptyState(hasSearch ? 'Nenhuma questão encontrada' : 'Seu banco inteiro está pronto', hasSearch ? 'Tente remover um filtro ou usar termos mais amplos.' : 'Use os filtros acima ou comece com todas as questões.', { action: 'study-all-questions', actionLabel: 'Praticar todas' })}
    `,
  };
}

export function reviewView(type: string | undefined, state: SiteState): ViewModel {
  const { questions } = getCatalog();
  const labels = {
    favoritas: ['Questões favoritas', 'Itens que você marcou para rever'],
    erradas: ['Questões erradas', 'Retome o que ainda precisa de atenção'],
    acertadas: ['Questões acertadas', 'Revise os conteúdos já consolidados'],
  };
  const reviewType = type === 'erradas' || type === 'acertadas' ? type : 'favoritas';
  const [title, subtitle] = labels[reviewType];
  const status = type === 'favoritas' ? 'favorites' : type === 'erradas' ? 'wrong' : 'correct';
  const filtered = applyAnswerStatus(questions, state, status);
  return {
    title,
    subtitle,
    content: `${stackHeader(title, formatCount(filtered.length, 'questão', 'questões'))}${filtered.length ? `<div class="dashboard-main result-list">${filtered.map((question) => questionResultCard(question, state)).join('')}</div>` : emptyState('Nada para revisar agora', 'Continue praticando e volte quando houver questões nesta lista.', { route: '/questoes', actionLabel: 'Praticar questões' })}`,
  };
}

export function questionsForSession(params: ViewParams, state: SiteState): Question[] {
  const { questions, packs } = getCatalog();
  let result = questions;
  if (params.id) result = questions.filter((question) => question.id === params.id);
  else {
    const pack = params.packId ? packs.find((item) => item.id === params.packId) : undefined;
    result = filterQuestions(questions, {
      keyword: params.keyword,
      discipline: params.discipline,
      topic: params.topic,
      board: params.board,
      difficulty: params.difficulty,
      pack,
    });
    result = applyAnswerStatus(result, state, params.status || params.review);
  }
  const offset = Math.max(0, Number(params.offset) || 0);
  if (params.limit) result = result.slice(offset, offset + Math.max(1, Number(params.limit)));
  else if (offset) result = result.slice(offset);
  return result;
}

export function questionSessionView(state: SiteState, params: ViewParams, ui: QuestionUiState): ViewModel {
  const questions = sessionQuestions(state, params, ui);
  const index = clamp(ui.questionIndex ?? 0, 0, Math.max(0, questions.length - 1));
  const question = questions[index];
  const title = params.challenge ? 'Desafio rápido' : params.topic || params.discipline || 'Sessão de questões';
  if (!question) {
    return { title, content: `${stackHeader(title)}${emptyState('Nenhuma questão nesta sessão', 'Escolha outro assunto ou ajuste os filtros.', { route: '/questoes', actionLabel: 'Voltar às questões' })}` };
  }
  const answer = state.answers[question.id];
  const favorite = state.favorites.includes(question.id);
  const comments = state.comments[question.id] ?? [];
  const communityAccuracy = state.communityAccuracy[question.id];
  ui.visitedQuestionIds ??= new Set();
  ui.visitedQuestionIds.add(question.id);
  const options = question.alternatives.map((alternative) => {
    const selected = answer?.selected === alternative.id;
    const correct = answer && question.correct === alternative.id;
    const wrong = answer && selected && !correct;
    const statusIcon = correct ? icon('CheckCircle2') : wrong ? icon('XCircle') : '';
    return `<button class="option ${selected ? 'is-selected' : ''} ${correct ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}" type="button" data-action="answer-question" data-question-id="${escapeHtml(question.id)}" data-alternative="${escapeHtml(alternative.id)}" ${answer ? 'disabled' : ''}><span class="option__letter">${escapeHtml(alternative.id)}</span><span>${escapeHtml(alternative.text)}</span>${statusIcon}</button>`;
  }).join('');
  const mapStart = Math.max(0, index - 20);
  const mapEnd = Math.min(questions.length, mapStart + 41);
  const mapIndexes = [...new Set([0, ...Array.from({ length: mapEnd - mapStart }, (_, n) => mapStart + n), questions.length - 1])].sort((a, b) => a - b);
  const map = mapIndexes.map((mapIndex) => {
    const item = questions[mapIndex];
    const answered = Boolean(state.answers[item.id]);
    const skipped = !answered && mapIndex !== index && ui.visitedQuestionIds.has(item.id);
    const stateLabel = answered ? ', respondida' : skipped ? ', pulada' : '';
    return `<button type="button" data-action="go-question" data-index="${mapIndex}" class="${mapIndex === index ? 'is-active' : ''} ${answered ? 'is-answered' : ''} ${skipped ? 'is-skipped' : ''}" aria-label="Questão ${mapIndex + 1}${stateLabel}">${mapIndex + 1}</button>`;
  }).join('');
  const commentList = comments.length
    ? comments.slice(0, 8).map((comment) => `<article class="comment"><div class="comment__heading"><strong>${escapeHtml(comment.author)}</strong><time datetime="${escapeHtml(comment.createdAt)}">${new Intl.DateTimeFormat('pt-BR').format(new Date(comment.createdAt))}</time></div><p>${escapeHtml(comment.text)}</p><div class="comment__actions">${state.auth.mode === 'authenticated' ? `<button type="button" data-action="like-comment" data-comment-id="${escapeHtml(comment.id)}" aria-pressed="${Boolean(comment.likedByMe)}" aria-label="${comment.likedByMe ? 'Remover curtida' : 'Curtir comentário'}">${icon('ThumbsUp')}<span>${comment.likes ?? 0}</span></button>` : ''}${comment.isOwn ? `<button type="button" data-action="edit-comment" data-comment-id="${escapeHtml(comment.id)}">${icon('Pencil')}<span>Editar</span></button><button type="button" data-action="delete-comment" data-comment-id="${escapeHtml(comment.id)}">${icon('Trash2')}<span>Excluir</span></button>` : ''}</div></article>`).join('')
    : '<p class="muted">Ainda não há comentários nesta questão.</p>';
  const progressValue = ((index + 1) / questions.length) * 100;
  const isLastQuestion = index === questions.length - 1;
  const forwardLabel = answer
    ? (isLastQuestion ? 'Concluir sessão' : 'Próxima questão')
    : (isLastQuestion ? 'Concluir sem responder' : 'Pular questão');
  const forwardButton = isLastQuestion
    ? button(forwardLabel, { route: '/perfil/desempenho', iconName: 'CheckCircle2' })
    : button(forwardLabel, { action: 'next-question', iconName: 'ChevronRight' });

  return {
    title,
    subtitle: `Questão ${index + 1} de ${questions.length}`,
    content: `
      ${stackHeader(title, `${question.discipline} · ${question.topic}`)}
      ${progress(progressValue, `Questão ${index + 1} de ${questions.length}`)}
      <div class="study-layout">
        ${card(`
          <div class="toolbar">
            <div class="question-meta">${badge(question.board, 'neutral')}${badge(String(question.year), 'neutral')}${badge(question.difficulty, 'accent')}</div>
            <button class="icon-button" type="button" data-action="toggle-favorite" data-question-id="${escapeHtml(question.id)}" aria-label="${favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">${icon(favorite ? 'BookmarkCheck' : 'Bookmark')}</button>
          </div>
          <p class="question-statement">${escapeHtml(question.statement)}</p>
          <fieldset ${ui.studyReady === false ? 'disabled' : ''} style="border:0;padding:0;margin:0;min-width:0"><legend class="sr-only">Alternativas</legend><div class="options">${options}</div></fieldset>
          ${ui.studySyncMessage ? `<p role="status">${escapeHtml(ui.studySyncMessage)}</p>${button('Sincronizar progresso', { action: 'sync-study', variant: 'ghost' })}` : ''}
          ${answer ? `<div class="explanation"><strong>${answer.isCorrect ? 'Resposta correta' : `Resposta incorreta · gabarito ${question.correct}`}</strong><p>${escapeHtml(question.explanation)}</p>${communityAccuracy ? `<small>${formatPercent(communityAccuracy.accuracy)} de acerto entre ${communityAccuracy.totalAnswers} ${communityAccuracy.totalAnswers === 1 ? 'resposta registrada' : 'respostas registradas'}.</small>` : ''}</div>` : ''}
          <div class="study-controls">
            ${button('Anterior', { action: 'previous-question', variant: 'secondary', iconName: 'ArrowLeft', disabled: index === 0 })}
            <div class="toolbar__group">${answer ? button('Tentar novamente', { action: 'retry-question', variant: 'ghost', iconName: 'RotateCcw', attrs: `data-question-id="${escapeHtml(question.id)}"` }) : ''}${forwardButton}</div>
          </div>
        `, 'question-card')}
        <aside class="study-side">
          ${card(`<p class="eyebrow">PROGRESSO</p><h3>Mapa da sessão</h3><div class="question-map">${map}</div>`, 'detail-panel')}
          ${card(`<details class="comments-disclosure" data-community-question-id="${escapeHtml(question.id)}" ${comments.length ? 'open' : ''}><summary><span><span class="eyebrow">COMUNIDADE</span><strong>Comentários</strong></span><span class="comments-disclosure__meta">${comments.length}</span>${icon('ChevronDown')}</summary><div class="comments-disclosure__content"><div class="comment-list">${commentList}</div>${state.auth.mode === 'authenticated' ? `<form class="comment-form" data-form="question-comment" data-question-id="${escapeHtml(question.id)}"><label for="comment-${escapeHtml(question.id)}">Participar da discussão</label><textarea class="textarea" id="comment-${escapeHtml(question.id)}" name="comment" maxlength="280" rows="3" placeholder="Compartilhe uma dúvida" required></textarea><p class="form-message" data-form-message></p>${button('Enviar comentário', { type: 'submit', variant: 'secondary', iconName: 'Send', size: 'sm' })}</form>` : `<div class="comment-login"><p>Entre na sua conta para ler a comunidade completa e participar.</p>${button('Entrar', { route: '/entrar', variant: 'secondary', size: 'sm' })}</div>`}</div></details>`, 'detail-panel comments-card')}
        </aside>
      </div>
    `,
  };
}

export function quickChallengeView(state: SiteState, ui: QuestionUiState): ViewModel {
  return questionSessionView(state, { challenge: '1', limit: '3' }, ui);
}
