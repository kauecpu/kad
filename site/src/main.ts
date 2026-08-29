import './styles/base.css';
import './styles/app.css';

import { getCatalog, replacePublishedCatalog } from './data/catalog.ts';
import { back, currentRoute, matchRoute, navigate, shouldOpenStudyHome, subscribeRouter } from './core/router.ts';
import { recordAnswer, store } from './core/store.ts';
import { randomId } from './core/utils.ts';
import { hydrateIcons } from './ui/icons.ts';
import { appLayout, publicLayout } from './ui/layout.ts';
import { emptyState, icon } from './ui/components.ts';
import { updateMetadata } from './services/metadata.ts';
import {
  cancelRemoteSubscription,
  completePasswordRecoveryCallback,
  createSubscriptionCheckout,
  getCurrentUser,
  loadPublishedContent,
  loadRemoteStudyData,
  loadRemoteSubscription,
  removeRemoteAnswer,
  requestPasswordRecovery,
  sendFeedback,
  signIn,
  signOut,
  signUp,
  saveRemoteAnswer,
  setRemoteFavorite,
  setRemoteSavedConcurso,
  supabaseConfigured,
  updateAccountPassword,
  updateRecoveredPassword,
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
import type {
  AlternativeId,
  BillingCycle,
  Route,
  SiteState,
  UiState,
  ViewModel,
} from './types/domain.ts';

const AUTH_STORY_INTERVAL = 6500;
let welcomeNavigationCleanup: (() => void) | null = null;
let publicAuthTrigger: HTMLElement | null = null;

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
        session.updatedAt = new Date().toISOString();
        if (session.remainingSeconds === 0) completeSimulation(draft);
      });
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
    ? publicLayout(view.content, { simple: view.layout === 'public-simple', dark: document.documentElement.dataset.theme === 'dark' })
    : appLayout(view.content, {
        pathname: route.pathname,
        title: view.title,
        subtitle: view.subtitle,
        state,
      });
  root.innerHTML = layout;
  hydrateIcons(root);
  updateMetadata({
    title: view.title,
    description: view.description,
    indexable: Boolean(view.indexable),
    path: route.pathname,
  });
  document.body.classList.remove('nav-open');
  startPageTimers(route, state);
  setupWelcomeNavigation(route);
  maybeConfirmCheckout(route, state);
  if (routeChanged) document.querySelector<HTMLElement>('#conteudo')?.focus({ preventScroll: true });
}

function persistEssayBuffer(): void {
  if (!ui.essayBuffer) return;
  const { topicId, content } = ui.essayBuffer;
  store.update((draft) => {
    const current = draft.essays[topicId] ?? { elapsedSeconds: 0 };
    draft.essays[topicId] = {
      ...current,
      content,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };
  }, { silent: true });
  ui.essayBuffer = null;
}

function completeSimulation(draft: SiteState): void {
  const session = draft.simulations.current;
  if (!session) return;
  session.status = 'completed';
  session.completedAt = session.completedAt ?? new Date().toISOString();
  session.updatedAt = new Date().toISOString();
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
      store.switchOwner(result.user.id);
      store.update((draft) => {
        draft.auth = { mode: 'authenticated', userId: result.user.id };
        draft.preferences.hasStarted = true;
        draft.profile.email = result.user.email ?? values.email;
        draft.profile.name = result.user.user_metadata?.full_name ?? draft.profile.name;
      });
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
      store.switchOwner(result.user.id);
      store.update((draft) => {
        draft.auth = { mode: 'authenticated', userId: result.user?.id ?? null };
        draft.preferences.hasStarted = true;
        draft.profile.email = result.user?.email ?? values.email;
      });
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
    store.update((draft) => {
      const current = draft.comments[questionId] ?? [];
      current.push({ id: randomId('comment'), author: draft.profile.name, text: values.comment.trim(), createdAt: new Date().toISOString() });
      draft.comments[questionId] = current.slice(-20);
    });
    toast('Comentário adicionado neste navegador.');
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

  if (formName === 'profile-edit') {
    store.update((draft) => {
      draft.profile = { ...draft.profile, ...values };
    });
    updateFormMessage(form, 'Dados salvos neste navegador.', 'success');
    toast('Perfil atualizado.');
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
    store.reset();
    toast('Os dados locais foram apagados.');
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
  dialog.setAttribute('aria-labelledby', mode === 'signup' ? 'public-signup-title' : 'public-login-title');
}

document.addEventListener('click', async (event) => {
  const source = event.target instanceof Element ? event.target : null;
  if (!source) return;
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
    document.body.classList.add('nav-open');
    target.setAttribute('aria-expanded', 'true');
    return;
  }
  if (action === 'close-menu') {
    document.body.classList.remove('nav-open');
    document.querySelector('[data-action="open-menu"]')?.setAttribute('aria-expanded', 'false');
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
  if (action === 'go-question') { ui.questionIndex = Number(target.dataset.index); render(); return; }
  if (action === 'previous-question') { ui.questionIndex = Math.max(0, ui.questionIndex - 1); render(); return; }
  if (action === 'next-question') { ui.questionIndex += 1; render(); return; }
  if (action === 'start-demo-simulation') {
    const session = createSimulation({ questionCount: 5, durationMinutes: 10 });
    if (!session) return;
    store.update((draft) => { draft.simulations.current = session; });
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
      session.updatedAt = new Date().toISOString();
    });
    return;
  }
  if (action === 'go-simulation-question') {
    store.update((draft) => { if (draft.simulations.current) draft.simulations.current.currentIndex = Number(target.dataset.index); });
    return;
  }
  if (action === 'previous-simulation-question' || action === 'next-simulation-question') {
    store.update((draft) => {
      const session = draft.simulations.current;
      if (!session) return;
      const delta = action === 'next-simulation-question' ? 1 : -1;
      session.currentIndex = Math.max(0, Math.min(session.questionIds.length - 1, session.currentIndex + delta));
    });
    return;
  }
  if (action === 'pause-simulation' || action === 'resume-simulation') {
    store.update((draft) => { if (draft.simulations.current) draft.simulations.current.status = action === 'pause-simulation' ? 'paused' : 'active'; });
    return;
  }
  if (action === 'finish-simulation') {
    store.update((draft) => completeSimulation(draft));
    navigate('/simulados/resultado');
    return;
  }
  if (action === 'discard-simulation') {
    store.update((draft) => { draft.simulations.current = null; });
    navigate('/simulados');
    return;
  }
  if (action === 'open-simulation-result') {
    if (target.dataset.simulationId) navigate(`/simulados/resultado?id=${encodeURIComponent(target.dataset.simulationId)}`);
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
  if (event.key === 'Escape') document.body.classList.remove('nav-open');
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

if (supabaseConfigured) {
  recoveryBootstrap.then(() => getCurrentUser()).then(async (user) => {
    if (!user) return;
    store.switchOwner(user.id);
    const [remote, subscription] = await Promise.all([
      loadRemoteStudyData(user.id).catch(() => null),
      loadRemoteSubscription(user.id).catch(() => null),
    ]);
    if (store.getOwnerId() !== user.id) return;
    store.update((draft) => {
      draft.auth = { mode: 'authenticated', userId: user.id };
      draft.preferences.hasStarted = true;
      draft.profile.email = user.email ?? draft.profile.email;
      draft.profile.name = user.user_metadata?.full_name ?? draft.profile.name;
      if (remote) {
        draft.answers = remote.answers;
        draft.favorites = remote.favorites;
        draft.savedConcursos = remote.savedConcursos;
      }
      if (subscription) draft.subscription = subscription;
    });
  });
  loadPublishedContent()
    .then((content) => {
      replacePublishedCatalog(content);
      render();
    })
    .catch(() => {
      // O catálogo compartilhado mantém o site utilizável se a rede falhar.
    });
}
