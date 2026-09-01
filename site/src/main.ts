import './styles/base.css';
import './styles/app.css';

import { getCatalog, replacePublishedCatalog } from './data/catalog.ts';
import { back, currentRoute, matchRoute, navigate, shouldOpenStudyHome, subscribeRouter } from './core/router.ts';
import {
  archiveCard as archiveFlashcard,
  archiveDeck as archiveFlashcardDeck,
  createCard,
  createDeck,
  mergeFlashcardStates,
  restoreCard as restoreFlashcard,
  restoreDeck as restoreFlashcardDeck,
  scheduleReview,
  withDeckCounts,
} from './core/flashcards.ts';
import { recordAnswer, store } from './core/store.ts';
import { mergeEssayDocuments, mergeSimulationSessions, nextSyncTimestamp, touchSimulationSession } from './core/user-sync.ts';
import { displayNameFromMetadata } from './core/auth-profile.ts';
import { classifyBackendState, type BackendState } from './core/backend-state.ts';
import { randomId } from './core/utils.ts';
import { hydrateIcons } from './ui/icons.ts';
import { appLayout, publicLayout } from './ui/layout.ts';
import { emptyState, icon } from './ui/components.ts';
import { updateMetadata } from './services/metadata.ts';
import {
  cancelRemoteSubscription,
  completePasswordRecoveryCallback,
  createQuestionComment,
  createSubscriptionCheckout,
  deleteRemoteSimulationSession,
  deleteQuestionComment,
  deleteRemoteAccount,
  getCurrentUser,
  initializeSupabase,
  loadPublishedContent,
  loadQuestionComments,
  loadQuestionCommunityAccuracy,
  loadRemoteEssayDocuments,
  loadRemoteFlashcards,
  loadRemoteProfile,
  loadRemoteSimulationSessions,
  loadRemoteStudyData,
  loadRemoteSubscription,
  removeRemoteCard,
  removeRemoteDeck,
  removeRemoteAnswer,
  requestPasswordRecovery,
  resendEmailConfirmation,
  saveRemoteCard,
  saveRemoteDeck,
  saveRemoteEssay,
  saveRemoteProfile,
  saveRemoteReview,
  saveRemoteSimulationSession,
  sendFeedback,
  signIn,
  signOut,
  signUp,
  saveRemoteAnswer,
  setRemoteFavorite,
  setRemoteSavedConcurso,
  setQuestionCommentLiked,
  supabaseConfigured,
  updateAccountPassword,
  updateQuestionComment,
  updateRecoveredPassword,
  uploadRemoteAvatar,
  verifyEmailOtp,
} from './services/supabase.ts';
import { authView, legalView, onboardingView, recoveryView, welcomeView } from './views/public.ts';
import { homeView } from './views/home.ts';
import {
  disciplineView,
  questionSessionView,
  questionsIndexView,
  quickChallengeView,
  reviewView,
  searchView,
} from './views/questions.ts';
import {
  createSimulation,
  simulationConfigView,
  simulationPlayerView,
  simulationResultView,
  simulationsView,
} from './views/simulations.ts';
import { concursoDetailView, concursosView, rankingView, trailsView } from './views/explore.ts';
import {
  deleteView,
  essayView,
  feedbackView,
  goalView,
  libraryView,
  passwordView,
  performanceView,
  plansView,
  profileEditView,
  profileView,
} from './views/profile.ts';
import {
  flashcardDeckEditorView,
  flashcardEditorView,
  flashcardReviewView,
  flashcardsView,
} from './views/flashcards.ts';
import type {
  AlternativeId,
  BillingCycle,
  FlashcardRating,
  Route,
  SiteState,
  UiState,
  ViewModel,
} from './types/domain.ts';

const AUTH_STORY_INTERVAL = 6500;
let backendState: BackendState = { connection: 'connecting', content: 'loading' };
let welcomeNavigationCleanup: (() => void) | null = null;
let publicAuthTrigger: HTMLElement | null = null;
let navigationTrigger: HTMLElement | null = null;
const loadedCommunityKeys = new Set<string>();
const loadingCommunityKeys = new Set<string>();

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`kad-site-element-missing:${selector}`);
  return element;
}

const root = requiredElement<HTMLElement>('#app');
const announcer = requiredElement<HTMLElement>('#announcer');

const ui: UiState = {
  questionIndex: 0,
  visitedQuestionIds: new Set<string>(),
  lastRouteKey: '',
  essayBuffer: null,
  toastTimer: null,
  simulationTimer: null,
  essayTimer: null,
  checkoutId: '',
  recoveryStatus: currentRoute().pathname === '/nova-senha' ? 'checking' : 'idle',
  checkoutTimer: null,
  authStoryIndex: 0,
  authStoryTimer: null,
  authStoryPaused: false,
  authStoryInteractionPaused: false,
  flashcardRevealId: null,
  essaySyncTimer: null,
  simulationSyncTimer: null,
};

function applyTheme(state: SiteState = store.getState()): void {
  const preference = state.preferences.theme;
  const dark = preference === 'dark'
    || (preference === 'system' && globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1118' : '#6d28d9');
}

function toast(message: string): void {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = 'toast';
  element.setAttribute('role', 'status');
  element.textContent = message;
  document.body.append(element);
  announcer.textContent = message;
  if (ui.toastTimer !== null) clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => element.remove(), 3600);
}

function setNavigationExpanded(expanded: boolean): void {
  document.querySelectorAll<HTMLElement>('[data-action="open-menu"]').forEach((trigger) => {
    trigger.setAttribute('aria-expanded', String(expanded));
  });
}

function closeNavigation({ restoreFocus = true }: { restoreFocus?: boolean } = {}): void {
  document.body.classList.remove('nav-open');
  setNavigationExpanded(false);
  const appColumn = document.querySelector<HTMLElement>('.app-column');
  const mobileTabs = document.querySelector<HTMLElement>('.mobile-tabs');
  if (appColumn) appColumn.inert = false;
  if (mobileTabs) mobileTabs.inert = false;
  if (restoreFocus && navigationTrigger?.isConnected) navigationTrigger.focus({ preventScroll: true });
  navigationTrigger = null;
}

function openNavigation(trigger: HTMLElement): void {
  navigationTrigger = trigger;
  document.body.classList.add('nav-open');
  setNavigationExpanded(true);
  const appColumn = document.querySelector<HTMLElement>('.app-column');
  const mobileTabs = document.querySelector<HTMLElement>('.mobile-tabs');
  if (appColumn) appColumn.inert = true;
  if (mobileTabs) mobileTabs.inert = true;
  globalThis.requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('.sidebar__close')?.focus({ preventScroll: true });
  });
}

async function hydrateAuthenticatedUser(user: { id: string; email?: string | null; user_metadata?: { name?: unknown; full_name?: unknown } }): Promise<void> {
  store.switchOwner(user.id);
  const [remote, subscription, profile, essays, simulations, flashcards] = await Promise.all([
    loadRemoteStudyData(user.id).catch(() => null),
    loadRemoteSubscription(user.id).catch(() => null),
    loadRemoteProfile(user.id).catch(() => null),
    loadRemoteEssayDocuments(user.id).catch(() => []),
    loadRemoteSimulationSessions(user.id).catch(() => []),
    loadRemoteFlashcards(user.id).catch(() => ({ decks: [], cards: [], reviews: [] })),
  ]);
  if (store.getOwnerId() !== user.id) return;
  const local = store.getState();
  const mergedSimulations = mergeSimulationSessions(
    local.simulations.current ? [local.simulations.current, ...local.simulations.history] : local.simulations.history,
    simulations,
  );
  const mergedEssays = mergeEssayDocuments(local.essays, essays);
  const mergedFlashcards = mergeFlashcardStates(local.flashcards, flashcards);
  store.update((draft) => {
    draft.auth = { mode: 'authenticated', userId: user.id };
    draft.preferences.hasStarted = true;
    draft.profile.email = user.email ?? draft.profile.email;
    draft.profile.name = displayNameFromMetadata(user.user_metadata, draft.profile.name);
    if (profile) draft.profile = { ...draft.profile, ...profile, email: user.email ?? draft.profile.email };
    if (remote) {
      draft.answers = remote.answers;
      draft.favorites = remote.favorites;
      draft.savedConcursos = remote.savedConcursos;
    }
    if (subscription) draft.subscription = subscription;
    draft.essays = mergedEssays;
    draft.simulations = mergedSimulations;
    draft.flashcards = mergedFlashcards;
  });
  const synced = store.getState();
  void Promise.all([
    ...Object.values(synced.essays).map((document) => saveRemoteEssay(user.id, document)),
    ...(synced.simulations.current ? [saveRemoteSimulationSession(user.id, synced.simulations.current)] : []),
    ...synced.simulations.history.map((session) => saveRemoteSimulationSession(user.id, session)),
    ...synced.flashcards.decks.map(saveRemoteDeck),
    ...synced.flashcards.cards.map(saveRemoteCard),
    ...synced.flashcards.reviews.map(saveRemoteReview),
  ]).catch(() => {});
}

function notFoundView(): ViewModel {
  return {
    title: 'Página não encontrada',
    content: emptyState('Esta página não existe', 'Use o menu para voltar ao seu ambiente de estudos.', { route: '/inicio', actionLabel: 'Ir para o início' }),
  };
}

function resolveView(route: Route, state: SiteState): ViewModel {
  const { pathname, params } = route;
  if (pathname === '/') return welcomeView();
  if (pathname === '/entrar') return authView('entrar');
  if (pathname === '/cadastro') return authView('cadastro');
  if (pathname === '/recuperar-senha') return recoveryView('request');
  if (pathname === '/confirmar-email') return recoveryView('confirmation', params);
  if (pathname === '/nova-senha') return recoveryView('new-password', { ...params, recoveryStatus: ui.recoveryStatus });
  if (pathname === '/onboarding') return onboardingView(state);
  if (pathname === '/termos') return legalView('termos');
  if (pathname === '/privacidade') return legalView('privacidade');
  if (pathname === '/inicio') return homeView(state);
  if (pathname === '/questoes') return questionsIndexView(state);
  if (pathname === '/questoes/buscar') return searchView(state, params);
  if (pathname === '/questoes/sessao') return questionSessionView(state, params, ui);
  if (pathname === '/questoes/desafio') return quickChallengeView(state, ui);
  if (pathname === '/questoes/revisar') return reviewView(params.tipo, state);
  const discipline = matchRoute('/questoes/disciplina/:slug', pathname);
  if (discipline) return disciplineView(discipline.slug, state);
  if (pathname === '/simulados') return simulationsView(state);
  if (pathname === '/simulados/configurar') return simulationConfigView(params);
  if (pathname === '/simulados/em-andamento') return simulationPlayerView(state);
  if (pathname === '/simulados/resultado') return simulationResultView(state, params.id);
  if (pathname === '/ranking') return rankingView(state, params);
  if (pathname === '/concursos') return concursosView(state, params);
  if (pathname === '/concursos/salvos') return concursosView(state, params, true);
  const concurso = matchRoute('/concursos/:id', pathname);
  if (concurso) return concursoDetailView(concurso.id, state);
  if (pathname === '/trilhas') return trailsView(state, params);
  if (pathname === '/redacao') return essayView(state, params);
  if (pathname === '/biblioteca') return libraryView();
  if (pathname === '/flashcards') return flashcardsView(state, params);
  if (pathname === '/flashcards/revisar') return flashcardReviewView(state, ui);
  const flashcard = matchRoute('/flashcards/cartao/:id', pathname);
  if (flashcard) return flashcardEditorView(state, flashcard.id);
  const flashcardDeck = matchRoute('/flashcards/baralho/:id', pathname);
  if (flashcardDeck) return flashcardDeckEditorView(state, flashcardDeck.id);
  if (pathname === '/perfil') return profileView(state);
  if (pathname === '/perfil/desempenho') return performanceView(state);
  if (pathname === '/perfil/editar') return profileEditView(state);
  if (pathname === '/perfil/planos') return plansView(state, params);
  if (pathname === '/perfil/feedback') return feedbackView(state);
  if (pathname === '/perfil/senha') return passwordView(state);
  if (pathname === '/perfil/excluir') return deleteView(state);
  if (pathname === '/meta') return goalView(state);
  return notFoundView();
}

function stopPageTimers() {
  if (ui.simulationTimer !== null) clearInterval(ui.simulationTimer);
  if (ui.essayTimer !== null) clearInterval(ui.essayTimer);
  if (ui.authStoryTimer !== null) clearInterval(ui.authStoryTimer);
  ui.simulationTimer = null;
  ui.essayTimer = null;
  ui.authStoryTimer = null;
  ui.authStoryInteractionPaused = false;
}

function queueEssaySync(document: SiteState['essays'][string]): void {
  const userId = store.getState().auth.userId;
  if (!userId) return;
  if (ui.essaySyncTimer !== null) clearTimeout(ui.essaySyncTimer);
  ui.essaySyncTimer = setTimeout(() => {
    ui.essaySyncTimer = null;
    void saveRemoteEssay(userId, document).catch(() => {});
  }, 700);
}

function queueSimulationSync(session = store.getState().simulations.current): void {
  const userId = store.getState().auth.userId;
  if (!userId || !session) return;
  if (ui.simulationSyncTimer !== null) clearTimeout(ui.simulationSyncTimer);
  ui.simulationSyncTimer = setTimeout(() => {
    ui.simulationSyncTimer = null;
    void saveRemoteSimulationSession(userId, session).catch(() => {});
  }, 700);
}

function showAuthStory(index: number, { announce = false }: { announce?: boolean } = {}): void {
  const carousel = document.querySelector<HTMLElement>('[data-auth-carousel]');
  if (!carousel) return;
  const slides = Array.from(carousel.querySelectorAll<HTMLElement>('[data-auth-slide]'));
  if (!slides.length) return;
  const requested = Number.isFinite(Number(index)) ? Number(index) : 0;
  const activeIndex = ((requested % slides.length) + slides.length) % slides.length;
  ui.authStoryIndex = activeIndex;
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === activeIndex;
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', String(!active));
  });
  carousel.querySelectorAll('[data-action="select-auth-story"]').forEach((dot, dotIndex) => {
    const active = dotIndex === activeIndex;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-pressed', String(active));
  });
  if (announce) {
    const status = carousel.querySelector('[data-auth-carousel-status]');
    const title = slides[activeIndex].dataset.slideTitle;
    if (status) status.textContent = `Destaque ${activeIndex + 1} de ${slides.length}: ${title}`;
  }
}

function updateAuthStoryPauseControl() {
  const control = document.querySelector('[data-action="pause-auth-story"]');
  if (!control) return;
  control.setAttribute('aria-pressed', String(ui.authStoryPaused));
  control.setAttribute('aria-label', ui.authStoryPaused ? 'Retomar rotação' : 'Pausar rotação');
  control.innerHTML = icon(ui.authStoryPaused ? 'Play' : 'Pause');
  hydrateIcons(control);
}

function startAuthStoryTimer() {
  if (ui.authStoryTimer !== null) clearInterval(ui.authStoryTimer);
  ui.authStoryTimer = null;
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!document.querySelector('[data-auth-carousel]') || reduceMotion || ui.authStoryPaused) return;
  ui.authStoryTimer = setInterval(() => {
    if (ui.authStoryInteractionPaused || document.hidden) return;
    showAuthStory(ui.authStoryIndex + 1);
  }, AUTH_STORY_INTERVAL);
}

function startPageTimers(route: Route, state: SiteState): void {
  stopPageTimers();
  if (route.pathname === '/entrar' || route.pathname === '/cadastro') {
    showAuthStory(ui.authStoryIndex);
    updateAuthStoryPauseControl();
    startAuthStoryTimer();
  }
  if (route.pathname === '/simulados/em-andamento' && state.simulations.current?.status === 'active') {
    ui.simulationTimer = setInterval(() => {
      const current = store.getState().simulations.current;
      if (!current || current.status !== 'active') return;
      store.update((draft) => {
        const session = draft.simulations.current;
        if (!session || session.status !== 'active') return;
        session.remainingSeconds = Math.max(0, session.remainingSeconds - 1);
        if (session.remainingSeconds % 10 === 0 || session.remainingSeconds === 0) {
          session.updatedAt = nextSyncTimestamp(session.updatedAt);
        }
        if (session.remainingSeconds === 0) completeSimulation(draft);
      });
      if ((store.getState().simulations.current?.remainingSeconds ?? 1) % 10 === 0) queueSimulationSync();
      if (store.getState().simulations.current?.status === 'completed') navigate('/simulados/resultado', { replace: true });
    }, 1000);
  }
  if (route.pathname === '/redacao' && route.params.topic && route.params.stage !== 'review') {
    let elapsed = state.essays[route.params.topic]?.elapsedSeconds ?? 0;
    ui.essayTimer = setInterval(() => {
      const topicId = route.params.topic;
      const timer = document.querySelector('[data-essay-timer]');
      elapsed += 1;
      if (elapsed % 5 === 0) {
        store.update((draft) => {
          const essay = draft.essays[topicId] ?? { content: '', elapsedSeconds: 0, updatedAt: new Date().toISOString() };
          essay.elapsedSeconds = elapsed;
          essay.updatedAt = new Date().toISOString();
          draft.essays[topicId] = essay;
          queueEssaySync(essay);
        }, { silent: true });
      }
      if (timer) {
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');
        timer.textContent = `${minutes}:${seconds}`;
      }
    }, 1000);
  }
}

function maybeConfirmCheckout(route: Route, state: SiteState): void {
  const checkoutId = route.pathname === '/perfil/planos' ? route.params.checkout : '';
  const validId = typeof checkoutId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutId);
  if (!validId || !state.auth.userId || ui.checkoutId === checkoutId) return;
  const userId = state.auth.userId;
  ui.checkoutId = checkoutId;
  let attempts = 0;
  const poll = async () => {
    attempts += 1;
    const subscription = await loadRemoteSubscription(userId).catch(() => null);
    if (subscription) store.update((draft) => { draft.subscription = subscription; });
    if (subscription?.plan === 'diamond') {
      toast('Pagamento confirmado. Seu acesso Diamond foi atualizado.');
      return;
    }
    if (attempts < 5) ui.checkoutTimer = setTimeout(poll, 3000);
  };
  void poll();
}

function setupWelcomeNavigation(route: Route): void {
  if (route.pathname !== '/') return;
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-public-section-target]'));
  const sections = links.map((link) => ({ link, section: document.getElementById(link.dataset.publicSectionTarget ?? '') }))
    .filter((item): item is { link: HTMLAnchorElement; section: HTMLElement } => item.section instanceof HTMLElement);
  if (!sections.length) return;

  let frame = 0;
  const setActive = (activeId: string) => {
    sections.forEach(({ link }) => {
      const active = link.dataset.publicSectionTarget === activeId;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  const update = () => {
    const headerHeight = document.querySelector<HTMLElement>('.public-header')?.getBoundingClientRect().height ?? 0;
    const marker = headerHeight + Math.min(globalThis.innerHeight * 0.22, 190);
    let active = sections[0];
    sections.forEach((item) => {
      if (item.section.getBoundingClientRect().top <= marker) active = item;
    });
    if (globalThis.scrollY + globalThis.innerHeight >= document.documentElement.scrollHeight - 8) active = sections.at(-1) ?? active;
    setActive(active.link.dataset.publicSectionTarget ?? 'kad-about');
    frame = 0;
  };
  const queueUpdate = () => {
    if (frame) return;
    frame = globalThis.requestAnimationFrame(update);
  };
  globalThis.addEventListener('scroll', queueUpdate, { passive: true });
  globalThis.addEventListener('resize', queueUpdate);
  update();

  const hashTarget = globalThis.location.hash ? document.querySelector<HTMLElement>(globalThis.location.hash) : null;
  if (hashTarget) globalThis.requestAnimationFrame(() => hashTarget.scrollIntoView({ block: 'start' }));

  welcomeNavigationCleanup = () => {
    globalThis.removeEventListener('scroll', queueUpdate);
    globalThis.removeEventListener('resize', queueUpdate);
    if (frame) globalThis.cancelAnimationFrame(frame);
  };
}

function hydrateQuestionCommunity(): void {
  const state = store.getState();
  const element = document.querySelector<HTMLElement>('[data-community-question-id]');
  const questionId = element?.dataset.communityQuestionId;
  const userId = state.auth.userId;
  if (!questionId || !userId) return;
  const key = `${userId}:${questionId}`;
  if (loadedCommunityKeys.has(key) || loadingCommunityKeys.has(key)) return;
  loadingCommunityKeys.add(key);
  void Promise.all([
    loadQuestionComments(questionId, userId),
    loadQuestionCommunityAccuracy(questionId),
  ]).then(([comments, accuracy]) => {
    loadedCommunityKeys.add(key);
    store.update((draft) => {
      draft.comments[questionId] = comments;
      if (accuracy) draft.communityAccuracy[questionId] = accuracy;
    });
  }).catch(() => {
    loadedCommunityKeys.add(key);
  }).finally(() => loadingCommunityKeys.delete(key));
}

function render({ routeChanged = false }: { routeChanged?: boolean } = {}): void {
  welcomeNavigationCleanup?.();
  welcomeNavigationCleanup = null;
  const route = currentRoute();
  const routeKey = `${route.pathname}${route.search}`;
  if (routeKey !== ui.lastRouteKey) {
    ui.questionIndex = 0;
    ui.visitedQuestionIds = new Set();
    routeChanged = true;
    ui.lastRouteKey = routeKey;
  }
  const state = store.getState();
  if (shouldOpenStudyHome(route.pathname, state)) {
    navigate('/inicio', { replace: true });
    return;
  }
  applyTheme(state);
  const view: ViewModel = resolveView(route, state);
  const layout = view.layout?.startsWith('public')
    ? publicLayout(view.content, { simple: view.layout === 'public-simple', dark: document.documentElement.dataset.theme === 'dark', backendState })
    : appLayout(view.content, {
        pathname: route.pathname,
        title: view.title,
        subtitle: view.subtitle,
        state,
        backendState,
      });
  root.innerHTML = layout;
  hydrateIcons(root);
  updateMetadata({
    title: view.title,
    description: view.description,
    indexable: Boolean(view.indexable),
    path: route.pathname,
  });
  closeNavigation({ restoreFocus: false });
  startPageTimers(route, state);
  setupWelcomeNavigation(route);
  hydrateQuestionCommunity();
  maybeConfirmCheckout(route, state);
  if (routeChanged) document.querySelector<HTMLElement>('#conteudo')?.focus({ preventScroll: true });
}

function persistEssayBuffer(): void {
  if (!ui.essayBuffer) return;
  const { topicId, content } = ui.essayBuffer;
  let saved: SiteState['essays'][string] | null = null;
  store.update((draft) => {
    const current = draft.essays[topicId] ?? { elapsedSeconds: 0 };
    draft.essays[topicId] = {
      ...current,
      content,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };
    saved = structuredClone(draft.essays[topicId]);
  }, { silent: true });
  if (saved) queueEssaySync(saved);
  ui.essayBuffer = null;
}

function completeSimulation(draft: SiteState): void {
  const session = draft.simulations.current;
  if (!session) return;
  session.status = 'completed';
  session.completedAt = session.completedAt ?? new Date().toISOString();
  session.updatedAt = nextSyncTimestamp(session.updatedAt);
  const history = draft.simulations.history.filter((item) => item.id !== session.id);
  draft.simulations.history = [structuredClone(session), ...history].slice(0, 20);
}

function updateFormMessage(form: HTMLFormElement, message: string, tone = ''): void {
  const target = form.querySelector('[data-form-message]');
  if (!target) return;
  target.textContent = message;
  target.className = `form-message ${tone ? `is-${tone}` : ''}`;
}

function readTextFormData(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value === 'string') values[key] = value;
  });
  return values;
}

async function handleForm(form: HTMLFormElement): Promise<void> {
  const values = readTextFormData(form);
  const formName = form.dataset.form;
  if (!form.reportValidity()) return;

  if (formName === 'login') {
    updateFormMessage(form, 'Entrando...');
    const result = await signIn(values.email, values.password);
    if (result.ok) {
      await hydrateAuthenticatedUser(result.user);
      navigate('/inicio', { replace: true });
    } else if (result.offline) updateFormMessage(form, 'O acesso à conta não está disponível neste ambiente. Você ainda pode continuar como visitante.', 'error');
    else updateFormMessage(form, result.message, 'error');
    return;
  }

  if (formName === 'signup') {
    if (values.password !== values.passwordConfirmation) {
      updateFormMessage(form, 'As senhas precisam ser iguais.', 'error');
      return;
    }
    updateFormMessage(form, 'Criando sua conta...');
    const result = await signUp({ name: values.name, email: values.email, password: values.password });
    if (result.ok) {
      const user = result.user;
      if (result.authenticated && user) {
        store.switchOwner(user.id);
        store.update((draft) => {
          draft.profile.name = values.name;
          draft.profile.email = values.email;
          draft.profile.username = `@${values.email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLocaleLowerCase('pt-BR')}`;
          draft.auth = { mode: 'authenticated', userId: user.id };
          draft.preferences.hasStarted = true;
        });
        await hydrateAuthenticatedUser(user);
      }
      navigate(result.requiresConfirmation ? `/confirmar-email?email=${encodeURIComponent(values.email)}` : '/onboarding', { replace: true });
    } else if (result.offline) updateFormMessage(form, 'A criação de conta não está disponível neste ambiente. Você ainda pode continuar como visitante.', 'error');
    else updateFormMessage(form, result.message, 'error');
    return;
  }

  if (formName === 'recovery') {
    const result = await requestPasswordRecovery(values.email);
    updateFormMessage(form, result.ok ? 'Confira seu e-mail para continuar.' : result.offline ? 'A recuperação de conta não está disponível neste ambiente.' : result.message, result.ok ? 'success' : 'error');
    return;
  }

  if (formName === 'confirmation') {
    const result = await verifyEmailOtp(values.email, values.code);
    if (result.ok) {
      await hydrateAuthenticatedUser(result.user);
      navigate('/onboarding', { replace: true });
    } else updateFormMessage(form, result.offline ? 'A confirmação de conta não está disponível neste ambiente.' : result.message, 'error');
    return;
  }

  if (formName === 'new-password' || formName === 'password-change') {
    if (values.password !== values.passwordConfirmation) {
      updateFormMessage(form, 'As senhas precisam ser iguais.', 'error');
      return;
    }
    const result = formName === 'new-password'
      ? await updateRecoveredPassword(values.password)
      : await updateAccountPassword(values.currentPassword, values.password);
    if (result.ok) {
      updateFormMessage(form, 'Senha atualizada com sucesso.', 'success');
      setTimeout(() => navigate('/perfil'), 700);
    } else updateFormMessage(form, result.offline ? 'Entre em uma conta conectada para alterar a senha.' : result.message, 'error');
    return;
  }

  if (formName === 'onboarding' || formName === 'goal') {
    store.update((draft) => {
      draft.profile.targetRole = values.targetRole?.trim() ?? '';
      draft.preferences.weeklyGoal = Number(values.weeklyGoal) || 30;
      draft.preferences.hasStarted = true;
    });
    const nextState = store.getState();
    if (nextState.auth.userId) {
      void saveRemoteProfile(nextState.auth.userId, nextState.profile).catch(() => {
        toast('Meta salva neste navegador; a sincronização será tentada novamente depois.');
      });
    }
    toast('Meta atualizada.');
    navigate('/inicio', { replace: formName === 'onboarding' });
    return;
  }

  if (formName === 'question-search') {
    const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
    navigate(`/questoes/buscar?${query}`);
    return;
  }

  if (formName === 'question-comment') {
    const questionId = form.dataset.questionId;
    if (!questionId) return;
    const state = store.getState();
    if (!state.auth.userId) return;
    updateFormMessage(form, 'Enviando...');
    try {
      const comment = await createQuestionComment(
        questionId,
        state.auth.userId,
        state.profile.name,
        values.comment.trim(),
      );
      store.update((draft) => {
        draft.comments[questionId] = [comment, ...(draft.comments[questionId] ?? []).filter((item) => item.id !== comment.id)];
      });
      toast('Comentário publicado.');
    } catch {
      updateFormMessage(form, 'Não foi possível publicar o comentário agora.', 'error');
    }
    return;
  }

  if (formName === 'simulation-config') {
    const shuffleQuestions = form.elements.namedItem('shuffleQuestions');
    const session = createSimulation({
      ...values,
      shuffleQuestions: shuffleQuestions instanceof HTMLInputElement ? shuffleQuestions.checked : false,
    });
    if (!session) {
      updateFormMessage(form, 'Nenhuma questão corresponde a esses filtros.', 'error');
      return;
    }
    store.update((draft) => { draft.simulations.current = session; });
    queueSimulationSync(session);
    navigate('/simulados/em-andamento');
    return;
  }

  if (formName === 'contest-search') {
    const savedOnly = values.savedOnly === '1';
    delete values.savedOnly;
    const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
    navigate(`${savedOnly ? '/concursos/salvos' : '/concursos'}${query.size ? `?${query}` : ''}`);
    return;
  }

  if (formName === 'essay-filter') {
    const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
    navigate(`/redacao${query.size ? `?${query}` : ''}`);
    return;
  }

  if (formName === 'flashcard-filter') {
    const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value && value !== 'all'));
    navigate(`/flashcards${query.size ? `?${query}` : ''}`);
    return;
  }

  if (formName === 'flashcard-deck') {
    const state = store.getState();
    const ownerId = state.auth.userId ?? 'guest';
    const duplicate = state.flashcards.decks.find((deck) => !deck.archivedAt
      && deck.name.trim().toLocaleLowerCase('pt-BR') === values.name.trim().toLocaleLowerCase('pt-BR'));
    if (duplicate) {
      updateFormMessage(form, 'Já existe um baralho ativo com esse nome.', 'error');
      return;
    }
    const deck = createDeck({ userId: ownerId, name: values.name, description: values.description, color: values.color });
    store.update((draft) => { draft.flashcards = withDeckCounts({ ...draft.flashcards, decks: [...draft.flashcards.decks, deck] }); });
    if (state.auth.userId) void saveRemoteDeck(deck).catch(() => {});
    form.reset();
    toast('Baralho criado.');
    return;
  }

  if (formName === 'flashcard-card') {
    const state = store.getState();
    const ownerId = state.auth.userId ?? 'guest';
    try {
      const cardItem = createCard({
        userId: ownerId,
        deckId: values.deckId,
        front: values.front,
        back: values.back,
        tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      store.update((draft) => { draft.flashcards = withDeckCounts({ ...draft.flashcards, cards: [...draft.flashcards.cards, cardItem] }); });
      if (state.auth.userId) void saveRemoteCard(cardItem).catch(() => {});
      form.reset();
      toast('Flashcard criado.');
    } catch (error) {
      updateFormMessage(form, error instanceof Error ? error.message : 'Não foi possível criar o cartão.', 'error');
    }
    return;
  }

  if (formName === 'flashcard-card-edit') {
    const cardId = form.dataset.cardId;
    if (!cardId) return;
    let changed = null as SiteState['flashcards']['cards'][number] | null;
    store.update((draft) => {
      draft.flashcards.cards = draft.flashcards.cards.map((cardItem) => {
        if (cardItem.id !== cardId) return cardItem;
        changed = {
          ...cardItem,
          deckId: values.deckId,
          front: values.front.trim(),
          back: values.back.trim(),
          tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
          updatedAt: new Date().toISOString(),
        };
        return changed;
      });
      draft.flashcards = withDeckCounts(draft.flashcards);
    });
    if (changed && store.getState().auth.userId) void saveRemoteCard(changed).catch(() => {});
    toast('Flashcard atualizado.');
    navigate('/flashcards');
    return;
  }

  if (formName === 'flashcard-deck-edit') {
    const deckId = form.dataset.deckId;
    if (!deckId) return;
    let changed = null as SiteState['flashcards']['decks'][number] | null;
    store.update((draft) => {
      draft.flashcards.decks = draft.flashcards.decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        changed = { ...deck, name: values.name.trim(), description: values.description.trim() || undefined, color: values.color, updatedAt: new Date().toISOString() };
        return changed;
      });
    });
    if (changed && store.getState().auth.userId) void saveRemoteDeck(changed).catch(() => {});
    toast('Baralho atualizado.');
    navigate('/flashcards');
    return;
  }

  if (formName === 'profile-edit') {
    updateFormMessage(form, 'Salvando...');
    const state = store.getState();
    const nextProfile = { ...state.profile, ...values };
    try {
      if (state.auth.userId) {
        await saveRemoteProfile(state.auth.userId, nextProfile);
        const avatarInput = form.elements.namedItem('avatar');
        const avatarFile = avatarInput instanceof HTMLInputElement ? avatarInput.files?.[0] : undefined;
        if (avatarFile) nextProfile.avatarUri = await uploadRemoteAvatar(state.auth.userId, avatarFile);
      }
      store.update((draft) => { draft.profile = nextProfile; });
      updateFormMessage(form, state.auth.userId ? 'Perfil sincronizado com sua conta.' : 'Dados salvos neste navegador.', 'success');
      toast('Perfil atualizado.');
    } catch (error) {
      updateFormMessage(form, error instanceof Error ? error.message : 'Não foi possível salvar o perfil agora.', 'error');
    }
    return;
  }

  if (formName === 'feedback') {
    const payload = { kind: values.kind, message: values.message.trim(), source: 'kad-site', created_at: new Date().toISOString() };
    const remote = await sendFeedback(payload).catch(() => ({ ok: false }));
    store.update((draft) => {
      draft.feedback.push({ id: randomId('feedback'), ...payload, synced: remote.ok });
    });
    form.reset();
    updateFormMessage(form, remote.ok ? 'Comentário enviado. Obrigado por ajudar o KAD.' : 'Comentário salvo localmente e pronto para sincronizar quando a integração estiver disponível.', 'success');
    return;
  }

  if (formName === 'delete-data') {
    if (values.confirmation !== 'APAGAR') {
      updateFormMessage(form, 'Digite APAGAR exatamente como indicado.', 'error');
      return;
    }
    const state = store.getState();
    if (state.auth.userId) {
      updateFormMessage(form, 'Excluindo sua conta...');
      const result = await deleteRemoteAccount(values.currentPassword);
      if (!result.ok) {
        updateFormMessage(form, result.offline ? 'A conexão com a conta não está disponível.' : result.message, 'error');
        return;
      }
    }
    store.reset();
    toast(state.auth.userId ? 'Sua conta foi excluída.' : 'Os dados locais foram apagados.');
    navigate('/', { replace: true });
  }
}

function actionFromElement(element: EventTarget | null): HTMLElement | null {
  return element instanceof Element ? element.closest<HTMLElement>('[data-action]') : null;
}

function isAlternativeId(value?: string): value is AlternativeId {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' || value === 'E';
}

function isBillingCycle(value?: string): value is BillingCycle {
  return value === 'monthly' || value === 'quarterly' || value === 'annual';
}

function isFlashcardRating(value?: string): value is FlashcardRating {
  return value === 'again' || value === 'hard' || value === 'good' || value === 'easy';
}

function setPublicAuthMode(dialog: HTMLDialogElement, requestedMode?: string): void {
  const mode = requestedMode === 'signup' ? 'signup' : 'login';
  dialog.querySelectorAll<HTMLElement>('[data-public-auth-form]').forEach((form) => {
    form.hidden = form.dataset.publicAuthForm !== mode;
  });
  dialog.querySelectorAll<HTMLElement>('[data-action="switch-public-auth"]').forEach((control) => {
    const active = control.dataset.authMode === mode;
    control.classList.toggle('is-active', active);
    control.setAttribute('aria-pressed', String(active));
  });
  dialog.querySelectorAll<HTMLElement>('[data-public-auth-visitor]').forEach((visitorAccess) => {
    visitorAccess.hidden = mode !== 'login';
  });
  dialog.setAttribute('aria-labelledby', mode === 'signup' ? 'public-signup-title' : 'public-login-title');
}

document.addEventListener('click', async (event) => {
  const source = event.target instanceof Element ? event.target : null;
  if (!source) return;
  const skipLink = source.closest<HTMLAnchorElement>('.skip-link');
  if (skipLink) {
    event.preventDefault();
    document.querySelector<HTMLElement>(skipLink.hash)?.focus();
    return;
  }
  const routeElement = source.closest<HTMLElement>('[data-route]');
  if (routeElement && (!(routeElement instanceof HTMLButtonElement) || !routeElement.disabled)) {
    const routeTarget = routeElement.dataset.route;
    if (!routeTarget) return;
    event.preventDefault();
    persistEssayBuffer();
    navigate(routeTarget);
    return;
  }

  const target = actionFromElement(event.target);
  if (!target || (target instanceof HTMLButtonElement && target.disabled)) return;
  const action = target.dataset.action;
  const state = store.getState();

  if (action === 'back') return back();
  if (action === 'toggle-password') {
    const controlId = target.getAttribute('aria-controls');
    const input = controlId ? document.getElementById(controlId) : null;
    if (!(input instanceof HTMLInputElement)) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    target.setAttribute('aria-pressed', String(!showing));
    target.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
    target.innerHTML = icon(showing ? 'Eye' : 'EyeOff');
    hydrateIcons(target);
    input.focus({ preventScroll: true });
    return;
  }
  if (action === 'open-menu') {
    openNavigation(target);
    return;
  }
  if (action === 'close-menu') {
    closeNavigation();
    return;
  }
  if (action === 'toggle-theme') {
    const dark = document.documentElement.dataset.theme === 'dark';
    store.update((draft) => { draft.preferences.theme = dark ? 'light' : 'dark'; });
    return;
  }
  if (action === 'open-public-auth') {
    const dialog = document.querySelector<HTMLDialogElement>('[data-public-auth-dialog]');
    if (!dialog) return;
    publicAuthTrigger = target;
    setPublicAuthMode(dialog, target.dataset.authMode);
    if (!dialog.open) dialog.showModal();
    const activeForm = dialog.querySelector<HTMLElement>(`[data-public-auth-form="${target.dataset.authMode === 'signup' ? 'signup' : 'login'}"]`);
    activeForm?.querySelector<HTMLInputElement>('input')?.focus();
    return;
  }
  if (action === 'close-public-auth') {
    const dialog = target.closest<HTMLDialogElement>('[data-public-auth-dialog]');
    dialog?.close();
    publicAuthTrigger?.focus({ preventScroll: true });
    return;
  }
  if (action === 'switch-public-auth') {
    const dialog = target.closest<HTMLDialogElement>('[data-public-auth-dialog]');
    if (!dialog) return;
    setPublicAuthMode(dialog, target.dataset.authMode);
    const activeForm = dialog.querySelector<HTMLElement>(`[data-public-auth-form="${target.dataset.authMode === 'signup' ? 'signup' : 'login'}"]`);
    activeForm?.querySelector<HTMLInputElement>('input')?.focus();
    return;
  }
  if (action === 'previous-auth-story' || action === 'next-auth-story' || action === 'select-auth-story') {
    const nextIndex = action === 'select-auth-story'
      ? Number(target.dataset.slideIndex)
      : ui.authStoryIndex + (action === 'next-auth-story' ? 1 : -1);
    showAuthStory(nextIndex, { announce: true });
    startAuthStoryTimer();
    return;
  }
  if (action === 'pause-auth-story') {
    ui.authStoryPaused = !ui.authStoryPaused;
    updateAuthStoryPauseControl();
    startAuthStoryTimer();
    return;
  }
  if (action === 'continue-visitor' || action === 'skip-onboarding') {
    store.switchOwner(null);
    store.update((draft) => {
      draft.auth = { mode: 'visitor', userId: null };
      draft.preferences.hasStarted = true;
    });
    navigate('/inicio');
    return;
  }
  if (action === 'resend-confirmation') {
    const form = target.closest<HTMLFormElement>('form');
    const email = form?.elements.namedItem('email');
    if (!(form instanceof HTMLFormElement) || !(email instanceof HTMLInputElement) || !email.value) return;
    updateFormMessage(form, 'Reenviando...');
    const result = await resendEmailConfirmation(email.value);
    updateFormMessage(form, result.ok ? 'Novo código enviado. Confira seu e-mail.' : result.offline ? 'A conexão com a conta não está disponível.' : result.message, result.ok ? 'success' : 'error');
    return;
  }
  if (action === 'open-question') {
    if (target.dataset.questionId) navigate(`/questoes/sessao?id=${encodeURIComponent(target.dataset.questionId)}`);
    return;
  }
  if (action === 'study-all-questions') return navigate('/questoes/sessao');
  if (action === 'study-search-results') return navigate(`/questoes/sessao?${target.dataset.search ?? ''}`);
  if (action === 'answer-question') {
    const selected = target.dataset.alternative;
    const question = getCatalog().questions.find((item) => item.id === target.dataset.questionId);
    if (!question || !isAlternativeId(selected)) return;
    store.update((draft) => recordAnswer(draft, question, selected));
    if (state.auth.userId) saveRemoteAnswer(question.id, selected).catch(() => {});
    announcer.textContent = selected === question.correct ? 'Resposta correta.' : `Resposta incorreta. Gabarito ${question.correct}.`;
    return;
  }
  if (action === 'retry-question') {
    const questionId = target.dataset.questionId;
    if (!questionId) return;
    store.update((draft) => { delete draft.answers[questionId]; });
    if (state.auth.userId) removeRemoteAnswer(state.auth.userId, questionId).catch(() => {});
    return;
  }
  if (action === 'toggle-favorite') {
    const id = target.dataset.questionId;
    if (!id) return;
    const favorite = !state.favorites.includes(id);
    store.update((draft) => {
      draft.favorites = draft.favorites.includes(id) ? draft.favorites.filter((item) => item !== id) : [id, ...draft.favorites];
    });
    if (state.auth.userId) setRemoteFavorite(state.auth.userId, id, favorite).catch(() => {});
    return;
  }
  if (action === 'like-comment') {
    const commentId = target.dataset.commentId;
    if (!commentId || !state.auth.userId) return;
    const questionId = Object.keys(state.comments).find((id) => state.comments[id].some((comment) => comment.id === commentId));
    const comment = questionId ? state.comments[questionId].find((item) => item.id === commentId) : undefined;
    if (!questionId || !comment) return;
    const liked = !comment.likedByMe;
    store.update((draft) => {
      const current = draft.comments[questionId]?.find((item) => item.id === commentId);
      if (!current) return;
      current.likedByMe = liked;
      current.likes = Math.max(0, current.likes + (liked ? 1 : -1));
    });
    void setQuestionCommentLiked(commentId, state.auth.userId, liked).catch(() => {
      store.update((draft) => {
        const current = draft.comments[questionId]?.find((item) => item.id === commentId);
        if (!current) return;
        current.likedByMe = !liked;
        current.likes = Math.max(0, current.likes + (liked ? -1 : 1));
      });
    });
    return;
  }
  if (action === 'edit-comment') {
    const commentId = target.dataset.commentId;
    if (!commentId || !state.auth.userId) return;
    const questionId = Object.keys(state.comments).find((id) => state.comments[id].some((comment) => comment.id === commentId));
    const comment = questionId ? state.comments[questionId].find((item) => item.id === commentId) : undefined;
    if (!questionId || !comment?.isOwn) return;
    const text = globalThis.prompt('Editar comentário', comment.text)?.trim();
    if (!text || text === comment.text) return;
    try {
      await updateQuestionComment(commentId, state.auth.userId, text);
      store.update((draft) => {
        const current = draft.comments[questionId]?.find((item) => item.id === commentId);
        if (current) { current.text = text; current.updatedAt = new Date().toISOString(); }
      });
      toast('Comentário atualizado.');
    } catch {
      toast('Não foi possível atualizar o comentário.');
    }
    return;
  }
  if (action === 'delete-comment') {
    const commentId = target.dataset.commentId;
    if (!commentId || !state.auth.userId || !globalThis.confirm('Excluir este comentário?')) return;
    const questionId = Object.keys(state.comments).find((id) => state.comments[id].some((comment) => comment.id === commentId));
    if (!questionId) return;
    try {
      await deleteQuestionComment(commentId, state.auth.userId);
      store.update((draft) => { draft.comments[questionId] = (draft.comments[questionId] ?? []).filter((item) => item.id !== commentId); });
      toast('Comentário excluído.');
    } catch {
      toast('Não foi possível excluir o comentário.');
    }
    return;
  }
  if (action === 'go-question') { ui.questionIndex = Number(target.dataset.index); render(); return; }
  if (action === 'previous-question') { ui.questionIndex = Math.max(0, ui.questionIndex - 1); render(); return; }
  if (action === 'next-question') { ui.questionIndex += 1; render(); return; }
  if (action === 'start-demo-simulation') {
    const session = createSimulation({ questionCount: 5, durationMinutes: 10 });
    if (!session) return;
    store.update((draft) => { draft.simulations.current = session; });
    queueSimulationSync(session);
    navigate('/simulados/em-andamento');
    return;
  }
  if (action === 'answer-simulation') {
    const questionId = target.dataset.questionId;
    const selected = target.dataset.alternative;
    if (!questionId || !isAlternativeId(selected)) return;
    store.update((draft) => {
      const session = draft.simulations.current;
      if (!session || session.status === 'completed') return;
      session.answers[questionId] = selected;
      session.updatedAt = nextSyncTimestamp(session.updatedAt);
    });
    queueSimulationSync();
    return;
  }
  if (action === 'go-simulation-question') {
    store.update((draft) => {
      if (!draft.simulations.current) return;
      draft.simulations.current.currentIndex = Number(target.dataset.index);
      draft.simulations.current.updatedAt = nextSyncTimestamp(draft.simulations.current.updatedAt);
    });
    queueSimulationSync();
    return;
  }
  if (action === 'previous-simulation-question' || action === 'next-simulation-question') {
    store.update((draft) => {
      const session = draft.simulations.current;
      if (!session) return;
      const delta = action === 'next-simulation-question' ? 1 : -1;
      session.currentIndex = Math.max(0, Math.min(session.questions.length - 1, session.currentIndex + delta));
      session.updatedAt = nextSyncTimestamp(session.updatedAt);
    });
    queueSimulationSync();
    return;
  }
  if (action === 'pause-simulation' || action === 'resume-simulation') {
    store.update((draft) => {
      if (!draft.simulations.current) return;
      draft.simulations.current = touchSimulationSession({
        ...draft.simulations.current,
        status: action === 'pause-simulation' ? 'paused' : 'active',
      });
    });
    queueSimulationSync();
    return;
  }
  if (action === 'finish-simulation') {
    store.update((draft) => completeSimulation(draft));
    queueSimulationSync();
    navigate('/simulados/resultado');
    return;
  }
  if (action === 'discard-simulation') {
    const sessionId = state.simulations.current?.id;
    store.update((draft) => { draft.simulations.current = null; });
    if (state.auth.userId && sessionId) void deleteRemoteSimulationSession(state.auth.userId, sessionId).catch(() => {});
    navigate('/simulados');
    return;
  }
  if (action === 'open-simulation-result') {
    if (target.dataset.simulationId) navigate(`/simulados/resultado?id=${encodeURIComponent(target.dataset.simulationId)}`);
    return;
  }
  if (action === 'focus-new-flashcard' || action === 'focus-new-deck') {
    const id = action === 'focus-new-flashcard' ? 'new-flashcard-card' : 'new-flashcard-deck';
    const form = document.getElementById(id);
    const details = form?.closest('details');
    if (details) details.open = true;
    form?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    form?.scrollIntoView({ behavior: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    return;
  }
  if (action === 'reveal-flashcard') {
    ui.flashcardRevealId = target.dataset.cardId ?? null;
    render();
    return;
  }
  if (action === 'rate-flashcard') {
    const cardId = target.dataset.cardId;
    const rating = target.dataset.rating;
    if (!cardId || !isFlashcardRating(rating)) return;
    const cardItem = state.flashcards.cards.find((item) => item.id === cardId);
    if (!cardItem) return;
    const result = scheduleReview(cardItem, rating);
    store.update((draft) => {
      draft.flashcards.cards = draft.flashcards.cards.map((item) => item.id === cardId ? result.card : item);
      if (!draft.flashcards.reviews.some((item) => item.id === result.review.id)) draft.flashcards.reviews.push(result.review);
    });
    if (state.auth.userId) void Promise.all([saveRemoteCard(result.card), saveRemoteReview(result.review)]).catch(() => {});
    ui.flashcardRevealId = null;
    announcer.textContent = 'Revisão registrada. Próximo cartão.';
    render();
    return;
  }
  if (action === 'archive-flashcard' || action === 'restore-flashcard') {
    const cardId = target.dataset.cardId;
    if (!cardId) return;
    store.update((draft) => {
      draft.flashcards = action === 'archive-flashcard'
        ? archiveFlashcard(draft.flashcards, cardId)
        : restoreFlashcard(draft.flashcards, cardId);
    });
    const changed = store.getState().flashcards.cards.find((item) => item.id === cardId);
    if (state.auth.userId && changed) void saveRemoteCard(changed).catch(() => {});
    return;
  }
  if (action === 'archive-deck' || action === 'restore-deck') {
    const deckId = target.dataset.deckId;
    if (!deckId) return;
    store.update((draft) => {
      draft.flashcards = action === 'archive-deck'
        ? archiveFlashcardDeck(draft.flashcards, deckId)
        : restoreFlashcardDeck(draft.flashcards, deckId);
    });
    const next = store.getState().flashcards;
    const changedDeck = next.decks.find((item) => item.id === deckId);
    const changedCards = next.cards.filter((item) => item.deckId === deckId);
    if (state.auth.userId && changedDeck) void Promise.all([saveRemoteDeck(changedDeck), ...changedCards.map(saveRemoteCard)]).catch(() => {});
    return;
  }
  if (action === 'delete-flashcard') {
    const cardId = target.dataset.cardId;
    if (!cardId || !globalThis.confirm('Excluir este flashcard?')) return;
    store.update((draft) => {
      draft.flashcards = withDeckCounts({ ...draft.flashcards, cards: draft.flashcards.cards.filter((item) => item.id !== cardId) });
    });
    if (state.auth.userId) void removeRemoteCard(state.auth.userId, cardId).catch(() => {});
    toast('Flashcard excluído.');
    return;
  }
  if (action === 'delete-deck') {
    const deckId = target.dataset.deckId;
    if (!deckId || !globalThis.confirm('Excluir este baralho e todos os cartões dele?')) return;
    store.update((draft) => {
      draft.flashcards = {
        decks: draft.flashcards.decks.filter((item) => item.id !== deckId),
        cards: draft.flashcards.cards.filter((item) => item.deckId !== deckId),
        reviews: draft.flashcards.reviews,
      };
    });
    if (state.auth.userId) void removeRemoteDeck(state.auth.userId, deckId).catch(() => {});
    toast('Baralho excluído.');
    return;
  }
  if (action === 'toggle-concurso') {
    const id = target.dataset.concursoId;
    if (!id) return;
    const saved = !state.savedConcursos.includes(id);
    store.update((draft) => {
      draft.savedConcursos = draft.savedConcursos.includes(id) ? draft.savedConcursos.filter((item) => item !== id) : [id, ...draft.savedConcursos];
    });
    if (state.auth.userId) setRemoteSavedConcurso(state.auth.userId, id, saved).catch(() => {});
    return;
  }
  if (action === 'ranking-period') {
    const params = currentRoute().params;
    if (!target.dataset.period) return;
    params.period = target.dataset.period;
    navigate(`/ranking?${new URLSearchParams(params)}`);
    return;
  }
  if (action === 'trail-mode') return navigate(`/trilhas?mode=${target.dataset.mode}`);
  if (action === 'sign-out') {
    await signOut();
    store.switchOwner(null);
    store.update((draft) => {
      draft.auth = { mode: 'visitor', userId: null };
      draft.preferences.hasStarted = false;
    });
    navigate('/', { replace: true });
    return;
  }
  if (action === 'start-checkout') {
    if (state.auth.mode !== 'authenticated') {
      toast('Entre em uma conta para assinar o KAD.');
      navigate('/entrar');
      return;
    }
    const cycle = target.dataset.cycle;
    if (!isBillingCycle(cycle)) return;
    if (target instanceof HTMLButtonElement) target.disabled = true;
    const result = await createSubscriptionCheckout(cycle);
    if (result.ok) globalThis.location.assign(result.checkoutUrl);
    else {
      if (target instanceof HTMLButtonElement) target.disabled = false;
      toast(result.offline ? 'O pagamento ainda não está configurado neste ambiente.' : result.message);
    }
    return;
  }
  if (action === 'refresh-subscription') {
    if (!state.auth.userId) return;
    const subscription = await loadRemoteSubscription(state.auth.userId).catch(() => null);
    if (subscription) {
      store.update((draft) => { draft.subscription = subscription; });
      toast('Assinatura atualizada.');
    } else toast('Não foi possível atualizar a assinatura agora.');
    return;
  }
  if (action === 'cancel-subscription') {
    if (!globalThis.confirm('Cancelar a renovação? Seu acesso continua até o fim do período já pago.')) return;
    const result = await cancelRemoteSubscription();
    if (result.ok) {
      if (!state.auth.userId) return;
      const subscription = await loadRemoteSubscription(state.auth.userId).catch(() => null);
      if (subscription) store.update((draft) => { draft.subscription = subscription; });
      toast('Renovação cancelada.');
    } else toast(result.message ?? 'Não foi possível cancelar agora.');
  }
});

document.addEventListener('pointerover', (event) => {
  const carousel = event.target instanceof Element ? event.target.closest('[data-auth-carousel]') : null;
  const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
  if (!carousel || carousel.contains(related)) return;
  ui.authStoryInteractionPaused = true;
});

document.addEventListener('pointerout', (event) => {
  const carousel = event.target instanceof Element ? event.target.closest('[data-auth-carousel]') : null;
  const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
  if (!carousel || carousel.contains(related)) return;
  ui.authStoryInteractionPaused = false;
  startAuthStoryTimer();
});

document.addEventListener('focusin', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-auth-carousel]')) ui.authStoryInteractionPaused = true;
});

document.addEventListener('focusout', (event) => {
  const carousel = event.target instanceof Element ? event.target.closest('[data-auth-carousel]') : null;
  const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
  if (!carousel || carousel.contains(related)) return;
  ui.authStoryInteractionPaused = false;
  startAuthStoryTimer();
});

document.addEventListener('submit', (event) => {
  const form = event.target instanceof Element ? event.target.closest<HTMLFormElement>('form[data-form]') : null;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  void handleForm(form);
});

document.addEventListener('change', (event) => {
  const element = event.target;
  if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) return;
  if (element.matches('[data-action="ranking-pack"]')) {
    const params = currentRoute().params;
    if (element.value) params.packId = element.value;
    else delete params.packId;
    navigate(`/ranking?${new URLSearchParams(params)}`);
  }
  if (element.matches('[data-action="trail-track"]')) {
    const params = currentRoute().params;
    params.track = element.value;
    navigate(`/trilhas?${new URLSearchParams(params)}`);
  }
});

document.addEventListener('input', (event) => {
  const textarea = event.target instanceof Element ? event.target.closest<HTMLTextAreaElement>('[data-essay-input]') : null;
  const topicId = textarea?.dataset.topicId;
  if (!(textarea instanceof HTMLTextAreaElement) || !topicId) return;
  ui.essayBuffer = { topicId, content: textarea.value };
  const wordCount = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
  const counter = document.querySelector<HTMLElement>('[data-word-count]');
  if (counter) counter.textContent = `${wordCount} palavras`;
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('pt-BR') === 'k') {
    event.preventDefault();
    persistEssayBuffer();
    navigate('/questoes/buscar');
  }
  if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
    event.preventDefault();
    closeNavigation();
    return;
  }
  if (event.key === 'Tab' && document.body.classList.contains('nav-open')) {
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const focusable = sidebar ? Array.from(sidebar.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')) : [];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

globalThis.addEventListener('beforeunload', persistEssayBuffer);
globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (store.getState().preferences.theme === 'system') applyTheme();
});
globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener('change', startAuthStoryTimer);

subscribeRouter(() => render({ routeChanged: true }));
store.subscribe(() => render());
applyTheme();
render({ routeChanged: true });

const recoveryBootstrap = currentRoute().pathname === '/nova-senha'
  ? completePasswordRecoveryCallback(globalThis.location.href)
    .then((result) => {
      ui.recoveryStatus = result.ok ? 'ready' : 'invalid';
      if (result.ok && result.user?.id) {
        store.switchOwner(result.user.id);
        store.update((draft) => {
          draft.auth = { mode: 'authenticated', userId: result.user.id };
          draft.profile.email = result.user.email ?? draft.profile.email;
        });
      }
      navigate('/nova-senha', { replace: true });
    })
    .catch(() => {
      ui.recoveryStatus = 'invalid';
      navigate('/nova-senha', { replace: true });
    })
  : Promise.resolve();

void initializeSupabase().then((configured) => {
  if (!configured || !supabaseConfigured) {
    backendState = classifyBackendState({ configured: false, loading: false, loadedFromRemote: false });
    render();
    return;
  }
  backendState = classifyBackendState({ configured: true, loading: true, loadedFromRemote: false });
  render();
  recoveryBootstrap.then(() => getCurrentUser()).then(async (user) => {
    if (!user) return;
    await hydrateAuthenticatedUser(user);
  });
  loadPublishedContent()
    .then((content) => {
      replacePublishedCatalog(content);
      backendState = classifyBackendState({
        configured: true,
        loading: false,
        loadedFromRemote: true,
        questionCount: content.questions.length,
        concursoCount: content.concursos.length,
      });
      render();
    })
    .catch(() => {
      // Em uma falha configurada, não apresentamos o catálogo local como se fosse remoto.
      replacePublishedCatalog({ questions: [], concursos: [] });
      backendState = classifyBackendState({
        configured: true,
        loading: false,
        error: 'published-content-unavailable',
        loadedFromRemote: false,
      });
      render();
    });
});
