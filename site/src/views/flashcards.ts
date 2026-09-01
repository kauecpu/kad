import { dueCards, filterFlashcards } from '../core/flashcards.ts';
import { escapeHtml, formatCount } from '../core/utils.ts';
import { badge, button, card, emptyState, icon, section, stat, workspaceHero } from '../ui/components.ts';
import { stackHeader } from '../ui/layout.ts';
import type { Flashcard, FlashcardDeck, SiteState, UiState, ViewModel } from '../types/domain.ts';

type ViewParams = Record<string, string | undefined>;

function deckLabel(deck: FlashcardDeck | undefined): string {
  return deck?.name ?? 'Baralho removido';
}

function dueLabel(card: Flashcard): string {
  if (Date.parse(card.dueAt) <= Date.now()) return 'Revisar agora';
  return `Próxima revisão ${new Intl.DateTimeFormat('pt-BR').format(new Date(card.dueAt))}`;
}

function flashcardRow(cardItem: Flashcard, decks: FlashcardDeck[]): string {
  const deck = decks.find((item) => item.id === cardItem.deckId);
  return `<article class="flashcard-row">
    <div class="flashcard-row__copy">
      <div class="question-meta">${badge(deckLabel(deck), 'accent')}${cardItem.tags.slice(0, 2).map((tag) => badge(`#${tag}`)).join('')}</div>
      <h3>${escapeHtml(cardItem.front)}</h3>
      <p>${escapeHtml(cardItem.back)}</p>
      <small>${escapeHtml(cardItem.archivedAt ? 'Arquivado' : dueLabel(cardItem))}</small>
    </div>
    <div class="flashcard-row__actions">
      ${button('Editar', { route: `/flashcards/cartao/${encodeURIComponent(cardItem.id)}`, variant: 'ghost', size: 'sm', iconName: 'Pencil' })}
      ${button(cardItem.archivedAt ? 'Restaurar' : 'Arquivar', { action: cardItem.archivedAt ? 'restore-flashcard' : 'archive-flashcard', variant: 'secondary', size: 'sm', iconName: cardItem.archivedAt ? 'RotateCcw' : 'Archive', attrs: `data-card-id="${escapeHtml(cardItem.id)}"` })}
      ${button('Excluir', { action: 'delete-flashcard', variant: 'danger', size: 'sm', iconName: 'Trash2', attrs: `data-card-id="${escapeHtml(cardItem.id)}"` })}
    </div>
  </article>`;
}

function deckRow(deck: FlashcardDeck): string {
  return `<article class="deck-row" style="--deck-color:${escapeHtml(deck.color ?? '#6d28d9')}">
    <span class="deck-row__mark" aria-hidden="true"></span>
    <div class="deck-row__copy"><strong>${escapeHtml(deck.name)}</strong><span>${formatCount(deck.cardCount, 'cartão ativo', 'cartões ativos')}${deck.description ? ` · ${escapeHtml(deck.description)}` : ''}</span></div>
    ${badge(deck.archivedAt ? 'Arquivado' : 'Ativo', deck.archivedAt ? 'warning' : 'success')}
    <div class="deck-row__actions">
      ${button('Editar', { route: `/flashcards/baralho/${encodeURIComponent(deck.id)}`, variant: 'ghost', size: 'sm', iconName: 'Pencil' })}
      ${button(deck.archivedAt ? 'Restaurar' : 'Arquivar', { action: deck.archivedAt ? 'restore-deck' : 'archive-deck', variant: 'secondary', size: 'sm', attrs: `data-deck-id="${escapeHtml(deck.id)}"` })}
      ${button('Excluir', { action: 'delete-deck', variant: 'danger', size: 'sm', attrs: `data-deck-id="${escapeHtml(deck.id)}"` })}
    </div>
  </article>`;
}

export function flashcardsView(state: SiteState, params: ViewParams = {}): ViewModel {
  const decks = state.flashcards.decks;
  const activeDecks = decks.filter((deck) => !deck.archivedAt);
  const due = dueCards(state.flashcards.cards);
  const filterState = params.state === 'archived' || params.state === 'all' ? params.state : 'active';
  const filtered = filterFlashcards(state.flashcards.cards, {
    query: params.q,
    deckId: params.deckId,
    state: filterState,
  });
  const canCreateCard = activeDecks.length > 0;
  return {
    title: 'Flashcards',
    subtitle: formatCount(due.length, 'revisão pendente', 'revisões pendentes'),
    content: `
      ${workspaceHero({
        id: 'flashcards-overview',
        eyebrow: 'REVISÃO ESPAÇADA',
        title: due.length ? 'Há conceitos prontos para revisar.' : 'Transforme conteúdo em memória de longo prazo.',
        description: state.auth.mode === 'authenticated'
          ? 'Seus baralhos, cartões e revisões acompanham a mesma conta usada no aplicativo.'
          : 'No modo visitante, seus flashcards ficam somente neste navegador.',
        actions: `${button(due.length ? `Revisar ${formatCount(due.length, 'cartão', 'cartões')}` : 'Revisões em dia', { route: '/flashcards/revisar', disabled: !due.length, iconName: 'Brain' })}${button('Novo cartão', { action: 'focus-new-flashcard', variant: 'secondary', iconName: 'Plus' })}${button('Novo baralho', { action: 'focus-new-deck', variant: 'ghost', iconName: 'FolderPlus' })}`,
      })}
      <section class="home-metrics page-metrics" aria-label="Resumo dos flashcards">
        ${stat(String(activeDecks.length), 'Baralhos ativos', 'Layers3')}
        ${stat(String(state.flashcards.cards.filter((item) => !item.archivedAt).length), 'Cartões ativos', 'PanelsTopLeft')}
        ${stat(String(due.length), 'Para revisar', 'Brain', due.length ? 'warning' : 'success')}
        ${stat(String(state.flashcards.reviews.length), 'Revisões feitas', 'CheckCircle2', 'success')}
      </section>
      <div class="flashcard-workspace">
        <section class="flashcard-workspace__main" aria-labelledby="flashcard-list-title">
          <form class="filter-bar filter-panel filter-panel--flashcards" data-form="flashcard-filter">
            <div class="field"><label for="flashcard-query">Buscar cartão</label><input class="input" id="flashcard-query" name="q" value="${escapeHtml(params.q ?? '')}" placeholder="Frente, verso ou tag" /></div>
            <div class="field"><label for="flashcard-deck-filter">Baralho</label><select class="select" id="flashcard-deck-filter" name="deckId"><option value="all">Todos</option>${decks.map((deck) => `<option value="${escapeHtml(deck.id)}" ${params.deckId === deck.id ? 'selected' : ''}>${escapeHtml(deck.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="flashcard-state-filter">Situação</label><select class="select" id="flashcard-state-filter" name="state"><option value="active" ${filterState === 'active' ? 'selected' : ''}>Ativos</option><option value="archived" ${filterState === 'archived' ? 'selected' : ''}>Arquivados</option><option value="all" ${filterState === 'all' ? 'selected' : ''}>Todos</option></select></div>
            ${button('Filtrar', { type: 'submit', iconName: 'Filter' })}
          </form>
          <div class="toolbar"><div><p class="eyebrow">SEUS CARTÕES</p><h2 id="flashcard-list-title">${formatCount(filtered.length, 'cartão', 'cartões')}</h2></div></div>
          ${filtered.length ? `<div class="flashcard-list">${filtered.map((item) => flashcardRow(item, decks)).join('')}</div>` : emptyState('Nenhum cartão encontrado', canCreateCard ? 'Crie um cartão ou ajuste os filtros para continuar.' : 'Crie primeiro um baralho para organizar seus cartões.', { action: canCreateCard ? 'focus-new-flashcard' : 'focus-new-deck', actionLabel: canCreateCard ? 'Criar cartão' : 'Criar baralho', iconName: 'Layers3' })}
        </section>
        <aside class="flashcard-workspace__aside">
          ${card(`<details class="creation-panel"><summary><span>${icon('Layers3')}<strong>Novo baralho</strong></span>${icon('ChevronDown')}</summary><form class="form-stack" data-form="flashcard-deck" id="new-flashcard-deck"><div class="field"><label for="deck-name">Nome</label><input class="input" id="deck-name" name="name" maxlength="120" placeholder="Ex.: Direito Constitucional" required /></div><div class="field"><label for="deck-description">Descrição</label><input class="input" id="deck-description" name="description" maxlength="240" placeholder="Opcional" /></div><div class="field field--color"><label for="deck-color">Cor do baralho</label><input id="deck-color" name="color" type="color" value="#6d28d9" /></div><p class="form-message" data-form-message></p>${button('Criar baralho', { type: 'submit', iconName: 'Plus' })}</form></details>`, 'creation-card')}
          ${card(`<details class="creation-panel"><summary><span>${icon('PanelsTopLeft')}<strong>Novo cartão</strong></span>${icon('ChevronDown')}</summary>${canCreateCard ? `<form class="form-stack" data-form="flashcard-card" id="new-flashcard-card"><div class="field"><label for="card-deck">Baralho</label><select class="select" id="card-deck" name="deckId" required>${activeDecks.map((deck) => `<option value="${escapeHtml(deck.id)}">${escapeHtml(deck.name)}</option>`).join('')}</select></div><div class="field"><label for="card-front">Frente</label><textarea class="textarea" id="card-front" name="front" maxlength="10000" rows="3" placeholder="Pergunta ou conceito" required></textarea></div><div class="field"><label for="card-back">Verso</label><textarea class="textarea" id="card-back" name="back" maxlength="10000" rows="4" placeholder="Resposta ou explicação" required></textarea></div><div class="field"><label for="card-tags">Tags</label><input class="input" id="card-tags" name="tags" placeholder="lei, revisão, artigo 5" /><small>Separe as tags por vírgulas.</small></div><p class="form-message" data-form-message></p>${button('Criar cartão', { type: 'submit', iconName: 'Plus' })}</form>` : '<p class="muted">Crie um baralho antes de adicionar cartões.</p>'}</details>`, 'creation-card')}
        </aside>
      </div>
      ${section('Baralhos', decks.length ? `<div class="deck-list">${decks.map(deckRow).join('')}</div>` : '<p class="muted">Seus baralhos aparecerão aqui.</p>', { eyebrow: 'ORGANIZAÇÃO' })}
    `,
  };
}

export function flashcardReviewView(state: SiteState, ui: Pick<UiState, 'flashcardRevealId'>): ViewModel {
  const queue = dueCards(state.flashcards.cards);
  const current = queue[0];
  if (!current) {
    return {
      title: 'Revisar flashcards',
      content: `${stackHeader('Revisar flashcards', 'Sessão concluída')}${emptyState('Revisões em dia', 'Você concluiu todos os cartões previstos para agora.', { route: '/flashcards', actionLabel: 'Voltar aos flashcards', iconName: 'CheckCircle2' })}`,
    };
  }
  const deck = state.flashcards.decks.find((item) => item.id === current.deckId);
  const revealed = ui.flashcardRevealId === current.id;
  return {
    title: 'Revisar flashcards',
    subtitle: formatCount(queue.length, 'cartão restante', 'cartões restantes'),
    content: `
      ${stackHeader('Revisar flashcards', deckLabel(deck))}
      <div class="review-session">
        <div class="review-session__progress"><span>${formatCount(queue.length, 'cartão restante', 'cartões restantes')}</span><span>${formatCount(state.flashcards.reviews.length, 'revisão registrada', 'revisões registradas')}</span></div>
        <article class="review-card ${revealed ? 'is-revealed' : ''}" aria-live="polite">
          <div class="review-card__face"><p class="eyebrow">FRENTE</p><h2>${escapeHtml(current.front)}</h2>${current.tags.length ? `<div class="question-meta">${current.tags.map((tag) => badge(`#${tag}`)).join('')}</div>` : ''}</div>
          ${revealed ? `<div class="review-card__answer"><p class="eyebrow">VERSO</p><p>${escapeHtml(current.back)}</p></div>` : ''}
        </article>
        ${revealed ? `<fieldset class="review-rating"><legend>Como foi lembrar?</legend><button type="button" data-action="rate-flashcard" data-card-id="${escapeHtml(current.id)}" data-rating="again"><strong>Errei</strong><span>10 minutos</span></button><button type="button" data-action="rate-flashcard" data-card-id="${escapeHtml(current.id)}" data-rating="hard"><strong>Difícil</strong><span>intervalo curto</span></button><button type="button" data-action="rate-flashcard" data-card-id="${escapeHtml(current.id)}" data-rating="good"><strong>Bom</strong><span>intervalo normal</span></button><button type="button" data-action="rate-flashcard" data-card-id="${escapeHtml(current.id)}" data-rating="easy"><strong>Fácil</strong><span>intervalo maior</span></button></fieldset>` : button('Mostrar resposta', { action: 'reveal-flashcard', iconName: 'Eye', size: 'lg', className: 'review-session__reveal', attrs: `data-card-id="${escapeHtml(current.id)}"` })}
      </div>`,
  };
}

export function flashcardEditorView(state: SiteState, cardId: string): ViewModel {
  const current = state.flashcards.cards.find((item) => item.id === cardId);
  const decks = state.flashcards.decks.filter((deck) => !deck.archivedAt || deck.id === current?.deckId);
  if (!current) return { title: 'Editar flashcard', content: `${stackHeader('Editar flashcard')}${emptyState('Cartão não encontrado', 'Ele pode ter sido excluído em outro dispositivo.', { route: '/flashcards', actionLabel: 'Voltar aos flashcards' })}` };
  return {
    title: 'Editar flashcard',
    content: `${stackHeader('Editar flashcard', deckLabel(decks.find((deck) => deck.id === current.deckId)))}<div class="form-page">${card(`<form class="form-stack" data-form="flashcard-card-edit" data-card-id="${escapeHtml(current.id)}"><div class="field"><label for="edit-card-deck">Baralho</label><select class="select" id="edit-card-deck" name="deckId" required>${decks.map((deck) => `<option value="${escapeHtml(deck.id)}" ${deck.id === current.deckId ? 'selected' : ''}>${escapeHtml(deck.name)}</option>`).join('')}</select></div><div class="field"><label for="edit-card-front">Frente</label><textarea class="textarea" id="edit-card-front" name="front" maxlength="10000" rows="4" required>${escapeHtml(current.front)}</textarea></div><div class="field"><label for="edit-card-back">Verso</label><textarea class="textarea" id="edit-card-back" name="back" maxlength="10000" rows="6" required>${escapeHtml(current.back)}</textarea></div><div class="field"><label for="edit-card-tags">Tags</label><input class="input" id="edit-card-tags" name="tags" value="${escapeHtml(current.tags.join(', '))}" /></div><p class="form-message" data-form-message></p>${button('Salvar alterações', { type: 'submit', iconName: 'Save' })}</form>`, 'form-panel')}</div>`,
  };
}

export function flashcardDeckEditorView(state: SiteState, deckId: string): ViewModel {
  const current = state.flashcards.decks.find((item) => item.id === deckId);
  if (!current) return { title: 'Editar baralho', content: `${stackHeader('Editar baralho')}${emptyState('Baralho não encontrado', 'Ele pode ter sido excluído em outro dispositivo.', { route: '/flashcards', actionLabel: 'Voltar aos flashcards' })}` };
  return {
    title: 'Editar baralho',
    content: `${stackHeader('Editar baralho', formatCount(current.cardCount, 'cartão ativo', 'cartões ativos'))}<div class="form-page">${card(`<form class="form-stack" data-form="flashcard-deck-edit" data-deck-id="${escapeHtml(current.id)}"><div class="field"><label for="edit-deck-name">Nome</label><input class="input" id="edit-deck-name" name="name" maxlength="120" value="${escapeHtml(current.name)}" required /></div><div class="field"><label for="edit-deck-description">Descrição</label><input class="input" id="edit-deck-description" name="description" maxlength="240" value="${escapeHtml(current.description ?? '')}" /></div><div class="field field--color"><label for="edit-deck-color">Cor</label><input id="edit-deck-color" name="color" type="color" value="${escapeHtml(current.color ?? '#6d28d9')}" /></div><p class="form-message" data-form-message></p>${button('Salvar alterações', { type: 'submit', iconName: 'Save' })}</form>`, 'form-panel')}</div>`,
  };
}
