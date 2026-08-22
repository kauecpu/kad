import { getCatalog } from '../data/catalog.js';
import {
  clamp,
  escapeHtml,
  filterQuestions,
  formatPercent,
  normalizeText,
  questionsPerformance,
  slugify,
  unique,
} from '../core/utils.js';
import { badge, button, card, emptyState, icon, progress, section } from '../ui/components.js';
import { stackHeader } from '../ui/layout.js';

function questionCountLabel(count) {
  return `${count} ${count === 1 ? 'questão' : 'questões'}`;
}

function questionResultCard(question, state) {
  const answer = state.answers[question.id];
  return card(`
    <button class="list-row" type="button" data-action="open-question" data-question-id="${escapeHtml(question.id)}">
      <span class="list-row__icon">${icon(answer ? (answer.isCorrect ? 'CheckCircle2' : 'XCircle') : 'BookOpen')}</span>
      <span class="list-row__copy"><strong>${escapeHtml(question.topic)}</strong><span>${escapeHtml(question.discipline)} · ${escapeHtml(question.board)} · ${question.year}</span></span>
      ${answer ? badge(answer.isCorrect ? 'Acertada' : 'Errada', answer.isCorrect ? 'success' : 'danger') : badge(question.difficulty)}
      ${icon('ChevronRight')}
    </button>`);
}

export function questionsIndexView(state) {
  const { disciplines, questions, packs } = getCatalog();
  const performance = questionsPerformance(state.answers);
  const disciplineCards = disciplines.map((discipline) => {
    const available = questions.filter((question) => question.discipline === discipline.name);
    const answered = available.filter((question) => state.answers[question.id]).length;
    return `<button class="discipline-card" type="button" data-route="/questoes/disciplina/${slugify(discipline.name)}" style="--discipline-color:${discipline.color}">
      <span class="discipline-card__mark">${escapeHtml(discipline.name.slice(0, 2).toUpperCase())}</span>
      <span class="discipline-card__copy"><h3>${escapeHtml(discipline.name)}</h3><p>${questionCountLabel(available.length)} · ${answered} respondidas</p></span>
      ${icon('ChevronRight')}
    </button>`;
  }).join('');

  return {
    title: 'Questões',
    subtitle: `${questions.length} questões disponíveis para praticar`,
    content: `
      ${card(`
        <div class="hero-card__content">
          <p class="eyebrow">EXPLORAR QUESTÕES</p>
          <h2>Escolha como estudar.</h2>
          <p>Filtre o banco inteiro, avance por disciplina ou pratique um concurso específico.</p>
          <div class="welcome__actions">
            ${button('Procurar questões', { route: '/questoes/buscar', iconName: 'Search' })}
            ${button('Desafio rápido', { route: '/questoes/desafio', variant: 'secondary', iconName: 'Zap' })}
          </div>
        </div>
        <div class="hero-card__art"><img src="/assets/kad-mascot-practice.png" alt="" width="300" height="300" /></div>
      `, 'hero-card')}
      <div class="summary-grid summary-grid--strip">
        ${card(`<div class="card--padded"><strong>${performance.total}</strong><p class="muted">respondidas</p></div>`)}
        ${card(`<div class="card--padded"><strong>${formatPercent(performance.accuracy)}</strong><p class="muted">taxa de acerto</p></div>`)}
        ${card(`<div class="card--padded"><strong>${state.favorites.length}</strong><p class="muted">favoritas</p></div>`)}
        ${card(`<div class="card--padded"><strong>${packs.length}</strong><p class="muted">áreas e concursos</p></div>`)}
      </div>
      ${section('Estudar por disciplina', `<div class="discipline-grid">${disciplineCards}</div>`, { eyebrow: 'BANCO DE QUESTÕES' })}
      ${section('Revisar', `<div class="action-grid">
        <button class="action-card" type="button" data-route="/questoes/revisar?tipo=favoritas"><span class="action-card__icon">${icon('Bookmark')}</span><div><h3>Favoritas</h3><p>${state.favorites.length} questões marcadas</p></div></button>
        <button class="action-card" type="button" data-route="/questoes/revisar?tipo=erradas"><span class="action-card__icon">${icon('RotateCcw')}</span><div><h3>Questões erradas</h3><p>Reforce os pontos frágeis</p></div></button>
        <button class="action-card" type="button" data-route="/concursos"><span class="action-card__icon">${icon('Building2')}</span><div><h3>Por concurso</h3><p>Pratique dentro da sua meta</p></div></button>
      </div>`)}
    `,
  };
}

export function disciplineView(slug, state) {
  const { disciplines, questions } = getCatalog();
  const discipline = disciplines.find((item) => slugify(item.name) === slug);
  if (!discipline) {
    return { title: 'Disciplina', content: `${stackHeader('Disciplina')}${emptyState('Disciplina não encontrada', 'Volte ao catálogo e escolha outra disciplina.', { route: '/questoes', actionLabel: 'Ver disciplinas' })}` };
  }
  const available = questions.filter((question) => question.discipline === discipline.name);
  const topicRows = discipline.topics.map((topic) => {
    const topicQuestions = available.filter((question) => question.topic === topic);
    const answered = topicQuestions.filter((question) => state.answers[question.id]).length;
    return `<button class="list-row" type="button" data-route="/questoes/sessao?discipline=${encodeURIComponent(discipline.name)}&topic=${encodeURIComponent(topic)}"><span class="list-row__icon">${icon('ListChecks')}</span><span class="list-row__copy"><strong>${escapeHtml(topic)}</strong><span>${questionCountLabel(topicQuestions.length)} · ${answered} respondidas</span></span>${badge(String(topicQuestions.length), topicQuestions.length ? 'accent' : 'neutral')}${icon('ChevronRight')}</button>`;
  }).join('');
  return {
    title: discipline.name,
    subtitle: `${questionCountLabel(available.length)} em ${discipline.topics.length} assuntos`,
    content: `
      ${stackHeader(discipline.name, questionCountLabel(available.length))}
      ${card(`<div class="detail-panel"><div><p class="eyebrow">SESSÃO GERAL</p><h2>Praticar todos os assuntos</h2></div><p class="muted">Misture as questões disponíveis desta disciplina em uma única sessão.</p>${button('Começar sessão', { route: `/questoes/sessao?discipline=${encodeURIComponent(discipline.name)}`, iconName: 'Play' })}</div>`)}
      ${section('Escolha um assunto', card(`<div class="list">${topicRows}</div>`))}
    `,
  };
}

function applyAnswerStatus(questions, state, status) {
  if (status === 'unanswered') return questions.filter((question) => !state.answers[question.id]);
  if (status === 'correct') return questions.filter((question) => state.answers[question.id]?.isCorrect);
  if (status === 'wrong') return questions.filter((question) => state.answers[question.id] && !state.answers[question.id].isCorrect);
  if (status === 'favorites') return questions.filter((question) => state.favorites.includes(question.id));
  return questions;
}

export function searchView(state, params = {}) {
  const { questions, disciplines } = getCatalog();
  const boards = unique(questions.map((question) => question.board)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filtered = applyAnswerStatus(filterQuestions(questions, params), state, params.status);
  const hasSearch = Object.values(params).some(Boolean);
  return {
    title: 'Procurar questões',
    subtitle: 'Combine filtros para montar sua prática',
    content: `
      ${stackHeader('Procurar questões', 'Use um ou mais filtros')}
      ${card(`<form class="filter-bar card--padded" data-form="question-search">
        <div class="field"><label class="sr-only" for="question-keyword">Palavra-chave</label><input class="input" id="question-keyword" name="keyword" value="${escapeHtml(params.keyword ?? '')}" placeholder="Enunciado, assunto, banca ou cargo" /></div>
        <div class="field"><label class="sr-only" for="question-discipline">Disciplina</label><select class="select" id="question-discipline" name="discipline"><option value="">Todas as disciplinas</option>${disciplines.map((item) => `<option value="${escapeHtml(item.name)}" ${params.discipline === item.name ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="sr-only" for="question-board">Banca</label><select class="select" id="question-board" name="board"><option value="">Todas as bancas</option>${boards.map((item) => `<option value="${escapeHtml(item)}" ${params.board === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></div>
        <div class="field"><label class="sr-only" for="question-status">Situação</label><select class="select" id="question-status" name="status"><option value="">Qualquer situação</option><option value="unanswered" ${params.status === 'unanswered' ? 'selected' : ''}>Não respondidas</option><option value="correct" ${params.status === 'correct' ? 'selected' : ''}>Acertadas</option><option value="wrong" ${params.status === 'wrong' ? 'selected' : ''}>Erradas</option></select></div>
        ${button('Buscar', { type: 'submit', iconName: 'Search' })}
      </form>`)}
      <div class="toolbar"><div><p class="eyebrow">RESULTADOS</p><h2>${questionCountLabel(filtered.length)}</h2></div>${filtered.length ? button('Estudar resultados', { action: 'study-search-results', iconName: 'Play', attrs: `data-search="${escapeHtml(new URLSearchParams(params).toString())}"` }) : ''}</div>
      ${filtered.length ? `<div class="dashboard-main">${filtered.slice(0, 40).map((question) => questionResultCard(question, state)).join('')}</div>` : emptyState(hasSearch ? 'Nenhuma questão encontrada' : 'Seu banco inteiro está pronto', hasSearch ? 'Tente remover um filtro ou usar termos mais amplos.' : 'Use os filtros acima ou comece com todas as questões.', { action: 'study-all-questions', actionLabel: 'Praticar todas' })}
    `,
  };
}

export function reviewView(type, state) {
  const { questions } = getCatalog();
  const labels = {
    favoritas: ['Questões favoritas', 'Itens que você marcou para rever'],
    erradas: ['Questões erradas', 'Retome o que ainda precisa de atenção'],
    acertadas: ['Questões acertadas', 'Revise os conteúdos já consolidados'],
  };
  const [title, subtitle] = labels[type] ?? labels.favoritas;
  const status = type === 'favoritas' ? 'favorites' : type === 'erradas' ? 'wrong' : 'correct';
  const filtered = applyAnswerStatus(questions, state, status);
  return {
    title,
    subtitle,
    content: `${stackHeader(title, questionCountLabel(filtered.length))}${filtered.length ? `<div class="dashboard-main">${filtered.map((question) => questionResultCard(question, state)).join('')}</div>` : emptyState('Nada para revisar agora', 'Continue praticando e volte quando houver questões nesta lista.', { route: '/questoes', actionLabel: 'Praticar questões' })}`,
  };
}

export function questionsForSession(params, state) {
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

export function questionSessionView(state, params, ui) {
  const questions = questionsForSession(params, state);
  const index = clamp(ui.questionIndex ?? 0, 0, Math.max(0, questions.length - 1));
  const question = questions[index];
  const title = params.challenge ? 'Desafio rápido' : params.topic || params.discipline || 'Sessão de questões';
  if (!question) {
    return { title, content: `${stackHeader(title)}${emptyState('Nenhuma questão nesta sessão', 'Escolha outro assunto ou ajuste os filtros.', { route: '/questoes', actionLabel: 'Voltar às questões' })}` };
  }
  const answer = state.answers[question.id];
  const favorite = state.favorites.includes(question.id);
  const comments = state.comments[question.id] ?? [];
  const options = question.alternatives.map((alternative) => {
    const selected = answer?.selected === alternative.id;
    const correct = answer && question.correct === alternative.id;
    const wrong = answer && selected && !correct;
    const statusIcon = correct ? icon('CheckCircle2') : wrong ? icon('XCircle') : '';
    return `<button class="option ${selected ? 'is-selected' : ''} ${correct ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}" type="button" data-action="answer-question" data-question-id="${escapeHtml(question.id)}" data-alternative="${escapeHtml(alternative.id)}" ${answer ? 'disabled' : ''}><span class="option__letter">${escapeHtml(alternative.id)}</span><span>${escapeHtml(alternative.text)}</span>${statusIcon}</button>`;
  }).join('');
  const map = questions.map((item, mapIndex) => `<button type="button" data-action="go-question" data-index="${mapIndex}" class="${mapIndex === index ? 'is-active' : ''} ${state.answers[item.id] ? 'is-answered' : ''}" aria-label="Questão ${mapIndex + 1}${state.answers[item.id] ? ', respondida' : ''}">${mapIndex + 1}</button>`).join('');
  const commentList = comments.length
    ? comments.slice(-4).map((comment) => `<div class="comment"><strong>${escapeHtml(comment.author)}</strong><p>${escapeHtml(comment.text)}</p></div>`).join('')
    : '<p class="muted">Ainda não há comentários nesta questão.</p>';
  const progressValue = ((index + 1) / questions.length) * 100;

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
          <div class="options">${options}</div>
          ${answer ? `<div class="explanation"><strong>${answer.isCorrect ? 'Resposta correta' : `Resposta incorreta · gabarito ${question.correct}`}</strong><p>${escapeHtml(question.explanation)}</p></div>` : ''}
          <div class="study-controls">
            ${button('Anterior', { action: 'previous-question', variant: 'secondary', iconName: 'ArrowLeft', disabled: index === 0 })}
            <div class="toolbar__group">${answer ? button('Tentar novamente', { action: 'retry-question', variant: 'ghost', iconName: 'RotateCcw', attrs: `data-question-id="${escapeHtml(question.id)}"` }) : ''}${index === questions.length - 1 ? button('Concluir sessão', { route: '/perfil/desempenho', iconName: 'CheckCircle2' }) : button('Próxima questão', { action: 'next-question', iconName: 'ChevronRight' })}</div>
          </div>
        `, 'question-card')}
        <aside class="study-side">
          ${card(`<p class="eyebrow">PROGRESSO</p><h3>Mapa da sessão</h3><div class="question-map">${map}</div>`, 'detail-panel')}
          ${card(`<p class="eyebrow">COMUNIDADE</p><h3>Comentários</h3><div class="comment-list">${commentList}</div><form class="comment-form" data-form="question-comment" data-question-id="${escapeHtml(question.id)}"><label class="sr-only" for="comment-${escapeHtml(question.id)}">Adicionar comentário</label><textarea class="textarea" id="comment-${escapeHtml(question.id)}" name="comment" maxlength="280" rows="3" placeholder="Compartilhe uma dúvida" required></textarea>${button('Enviar comentário', { type: 'submit', variant: 'secondary', iconName: 'Send', size: 'sm' })}</form>`, 'detail-panel')}
        </aside>
      </div>
    `,
  };
}

export function quickChallengeView(state, ui) {
  return questionSessionView(state, { challenge: '1', limit: '3' }, ui);
}
