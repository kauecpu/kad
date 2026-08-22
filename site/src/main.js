import './styles/base.css';
import './styles/app.css';

import { getCatalog, replacePublishedCatalog } from './data/catalog.js';
import { back, currentRoute, matchRoute, navigate, shouldOpenStudyHome, subscribeRouter } from './core/router.js';
import { recordAnswer, store } from './core/store.js';
import { randomId } from './core/utils.js';
import { hydrateIcons } from './ui/icons.js';
import { appLayout, publicLayout } from './ui/layout.js';
import { emptyState } from './ui/components.js';
import { updateMetadata } from './services/metadata.js';
import {
  cancelRemoteSubscription,
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
  updatePassword,
  verifyEmailOtp,
} from './services/supabase.js';
import { authView, legalView, onboardingView, recoveryView, welcomeView } from './views/public.js';
import { homeView } from './views/home.js';
import {
  disciplineView,
  questionSessionView,
  questionsIndexView,
  quickChallengeView,
  reviewView,
  searchView,
} from './views/questions.js';
import {
  createSimulation,
  simulationConfigView,
  simulationPlayerView,
  simulationResultView,
  simulationsView,
} from './views/simulations.js';
import { concursoDetailView, concursosView, rankingView, trailsView } from './views/explore.js';
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
} from './views/profile.js';

const root = document.querySelector('#app');
const announcer = document.querySelector('#announcer');
const ui = {
  questionIndex: 0,
  lastRouteKey: '',
  essayBuffer: null,
  toastTimer: null,
  simulationTimer: null,
  essayTimer: null,
  checkoutId: '',
  checkoutTimer: null,
};

function applyTheme(state = store.getState()) {
  const preference = state.preferences.theme;
  const dark = preference === 'dark'
    || (preference === 'system' && globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1118' : '#6d28d9');
}

function toast(message) {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = 'toast';
  element.setAttribute('role', 'status');
  element.textContent = message;
  document.body.append(element);
  announcer.textContent = message;
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => element.remove(), 3600);
}

function notFoundView() {
  return {
    title: 'Página não encontrada',
    content: emptyState('Esta página não existe', 'Use o menu para voltar ao seu ambiente de estudos.', { route: '/inicio', actionLabel: 'Ir para o início' }),
  };
}

function resolveView(route, state) {
  const { pathname, params } = route;
  if (pathname === '/') return welcomeView();
  if (pathname === '/entrar') return authView('entrar');
  if (pathname === '/cadastro') return authView('cadastro');
  if (pathname === '/recuperar-senha') return recoveryView('request');
  if (pathname === '/confirmar-email') return recoveryView('confirmation', params);
  if (pathname === '/nova-senha') return recoveryView('new-password', params);
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
  clearInterval(ui.simulationTimer);
  clearInterval(ui.essayTimer);
  ui.simulationTimer = null;
  ui.essayTimer = null;
}

function startPageTimers(route, state) {
  stopPageTimers();
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

function maybeConfirmCheckout(route, state) {
  const checkoutId = route.pathname === '/perfil/planos' ? route.params.checkout : '';
  const validId = typeof checkoutId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutId);
  if (!validId || !state.auth.userId || ui.checkoutId === checkoutId) return;
  ui.checkoutId = checkoutId;
  let attempts = 0;
  const poll = async () => {
    attempts += 1;
    const subscription = await loadRemoteSubscription(state.auth.userId).catch(() => null);
    if (subscription) store.update((draft) => { draft.subscription = subscription; });
    if (subscription?.plan === 'diamond') {
      toast('Pagamento confirmado. Seu acesso Diamond foi atualizado.');
      return;
    }
    if (attempts < 5) ui.checkoutTimer = setTimeout(poll, 3000);
  };
  void poll();
}

function render({ routeChanged = false } = {}) {
  const route = currentRoute();
  const routeKey = `${route.pathname}${route.search}`;
  if (routeKey !== ui.lastRouteKey) {
    ui.questionIndex = 0;
    routeChanged = true;
    ui.lastRouteKey = routeKey;
  }
  const state = store.getState();
  if (shouldOpenStudyHome(route.pathname, state)) {
    navigate('/inicio', { replace: true });
    return;
  }
  applyTheme(state);
  const view = resolveView(route, state);
  const layout = view.layout?.startsWith('public')
    ? publicLayout(view.content, { simple: view.layout === 'public-simple' })
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
  maybeConfirmCheckout(route, state);
  if (routeChanged) document.querySelector('#conteudo')?.focus?.({ preventScroll: true });
}

function persistEssayBuffer() {
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

function completeSimulation(draft) {
  const session = draft.simulations.current;
  if (!session) return;
  session.status = 'completed';
  session.completedAt = session.completedAt ?? new Date().toISOString();
  session.updatedAt = new Date().toISOString();
  const history = draft.simulations.history.filter((item) => item.id !== session.id);
  draft.simulations.history = [structuredClone(session), ...history].slice(0, 20);
}

function updateFormMessage(form, message, tone = '') {
  const target = form.querySelector('[data-form-message]');
  if (!target) return;
  target.textContent = message;
  target.className = `form-message ${tone ? `is-${tone}` : ''}`;
}

async function handleForm(form) {
  const values = Object.fromEntries(new FormData(form));
  const formName = form.dataset.form;
  if (!form.reportValidity()) return;

  if (formName === 'login') {
    updateFormMessage(form, 'Entrando...');
    const result = await signIn(values.email, values.password);
    if (result.ok) {
      store.update((draft) => {
        draft.auth = { mode: 'authenticated', userId: result.user.id };
        draft.preferences.hasStarted = true;
        draft.profile.email = result.user.email ?? values.email;
        draft.profile.name = result.user.user_metadata?.full_name ?? draft.profile.name;
      });
      navigate('/inicio', { replace: true });
    } else if (result.offline) {
      store.update((draft) => {
        draft.auth = { mode: 'visitor', userId: null };
        draft.preferences.hasStarted = true;
        draft.profile.email = values.email;
      });
      toast('Supabase não configurado: você entrou no modo demonstrativo.');
      navigate('/inicio', { replace: true });
    } else updateFormMessage(form, result.message, 'error');
    return;
  }

  if (formName === 'signup') {
    if (values.password !== values.passwordConfirmation) {
      updateFormMessage(form, 'As senhas precisam ser iguais.', 'error');
      return;
    }
    updateFormMessage(form, 'Criando sua conta...');
    const result = await signUp(values);
    store.update((draft) => {
      draft.profile.name = values.name;
      draft.profile.email = values.email;
      draft.profile.username = `@${values.email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLocaleLowerCase('pt-BR')}`;
      draft.auth = result.ok ? { mode: 'authenticated', userId: result.user?.id ?? null } : { mode: 'visitor', userId: null };
      draft.preferences.hasStarted = true;
    });
    if (result.ok) navigate(result.requiresConfirmation ? `/confirmar-email?email=${encodeURIComponent(values.email)}` : '/onboarding', { replace: true });
    else if (result.offline) {
      toast('Conta remota indisponível: seus dados ficarão somente neste navegador.');
      navigate('/onboarding', { replace: true });
    } else updateFormMessage(form, result.message, 'error');
    return;
  }

  if (formName === 'recovery') {
    const result = await requestPasswordRecovery(values.email);
    updateFormMessage(form, result.ok ? 'Confira seu e-mail para continuar.' : result.offline ? 'A recuperação será ativada quando o Supabase web estiver configurado.' : result.message, result.ok ? 'success' : 'error');
    return;
  }

  if (formName === 'confirmation') {
    const result = await verifyEmailOtp(values.email, values.code);
    if (result.ok) {
      store.update((draft) => {
        draft.auth = { mode: 'authenticated', userId: result.user?.id ?? null };
        draft.preferences.hasStarted = true;
        draft.profile.email = result.user?.email ?? values.email;
      });
      navigate('/onboarding', { replace: true });
    } else updateFormMessage(form, result.offline ? 'A confirmação exige a configuração pública do Supabase.' : result.message, 'error');
    return;
  }

  if (formName === 'new-password' || formName === 'password-change') {
    if (values.password !== values.passwordConfirmation) {
      updateFormMessage(form, 'As senhas precisam ser iguais.', 'error');
      return;
    }
    const result = await updatePassword(values.password);
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
    store.update((draft) => {
      const current = draft.comments[questionId] ?? [];
      current.push({ id: randomId('comment'), author: draft.profile.name, text: values.comment.trim(), createdAt: new Date().toISOString() });
      draft.comments[questionId] = current.slice(-20);
    });
    toast('Comentário adicionado neste navegador.');
    return;
  }

  if (formName === 'simulation-config') {
    const session = createSimulation({
      ...values,
      shuffleQuestions: form.elements.shuffleQuestions.checked,
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

function actionFromElement(element) {
  return element.closest('[data-action]');
}

document.addEventListener('click', async (event) => {
  const routeElement = event.target.closest('[data-route]');
  if (routeElement && !routeElement.disabled) {
    event.preventDefault();
    persistEssayBuffer();
    navigate(routeElement.dataset.route);
    return;
  }

  const target = actionFromElement(event.target);
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  const state = store.getState();

  if (action === 'back') return back();
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
  if (action === 'continue-visitor' || action === 'skip-onboarding') {
    store.update((draft) => {
      draft.auth = { mode: 'visitor', userId: null };
      draft.preferences.hasStarted = true;
    });
    navigate('/inicio');
    return;
  }
  if (action === 'open-question') {
    navigate(`/questoes/sessao?id=${encodeURIComponent(target.dataset.questionId)}`);
    return;
  }
  if (action === 'study-all-questions') return navigate('/questoes/sessao');
  if (action === 'study-search-results') return navigate(`/questoes/sessao?${target.dataset.search ?? ''}`);
  if (action === 'answer-question') {
    const question = getCatalog().questions.find((item) => item.id === target.dataset.questionId);
    if (!question) return;
    store.update((draft) => recordAnswer(draft, question, target.dataset.alternative));
    if (state.auth.userId) saveRemoteAnswer(question.id, target.dataset.alternative).catch(() => {});
    announcer.textContent = target.dataset.alternative === question.correct ? 'Resposta correta.' : `Resposta incorreta. Gabarito ${question.correct}.`;
    return;
  }
  if (action === 'retry-question') {
    store.update((draft) => { delete draft.answers[target.dataset.questionId]; });
    if (state.auth.userId) removeRemoteAnswer(state.auth.userId, target.dataset.questionId).catch(() => {});
    return;
  }
  if (action === 'toggle-favorite') {
    const id = target.dataset.questionId;
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
    store.update((draft) => { draft.simulations.current = session; });
    navigate('/simulados/em-andamento');
    return;
  }
  if (action === 'answer-simulation') {
    store.update((draft) => {
      const session = draft.simulations.current;
      if (!session || session.status === 'completed') return;
      session.answers[target.dataset.questionId] = target.dataset.alternative;
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
  if (action === 'open-simulation-result') return navigate(`/simulados/resultado?id=${encodeURIComponent(target.dataset.simulationId)}`);
  if (action === 'toggle-concurso') {
    const id = target.dataset.concursoId;
    const saved = !state.savedConcursos.includes(id);
    store.update((draft) => {
      draft.savedConcursos = draft.savedConcursos.includes(id) ? draft.savedConcursos.filter((item) => item !== id) : [id, ...draft.savedConcursos];
    });
    if (state.auth.userId) setRemoteSavedConcurso(state.auth.userId, id, saved).catch(() => {});
    return;
  }
  if (action === 'ranking-period') {
    const params = currentRoute().params;
    params.period = target.dataset.period;
    navigate(`/ranking?${new URLSearchParams(params)}`);
    return;
  }
  if (action === 'trail-mode') return navigate(`/trilhas?mode=${target.dataset.mode}`);
  if (action === 'sign-out') {
    await signOut();
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
    target.disabled = true;
    const result = await createSubscriptionCheckout(target.dataset.cycle);
    if (result.ok) globalThis.location.assign(result.checkoutUrl);
    else {
      target.disabled = false;
      toast(result.offline ? 'O pagamento ainda não está configurado neste ambiente.' : result.message);
    }
    return;
  }
  if (action === 'refresh-subscription') {
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
      const subscription = await loadRemoteSubscription(state.auth.userId).catch(() => null);
      if (subscription) store.update((draft) => { draft.subscription = subscription; });
      toast('Renovação cancelada.');
    } else toast(result.message ?? 'Não foi possível cancelar agora.');
  }
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  void handleForm(form);
});

document.addEventListener('change', (event) => {
  const element = event.target;
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
  const textarea = event.target.closest('[data-essay-input]');
  if (!textarea) return;
  ui.essayBuffer = { topicId: textarea.dataset.topicId, content: textarea.value };
  const wordCount = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
  document.querySelector('[data-word-count]').textContent = `${wordCount} palavras`;
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

subscribeRouter(() => render({ routeChanged: true }));
store.subscribe(() => render());
applyTheme();
render({ routeChanged: true });

if (supabaseConfigured) {
  getCurrentUser().then(async (user) => {
    if (!user) return;
    const [remote, subscription] = await Promise.all([
      loadRemoteStudyData(user.id).catch(() => null),
      loadRemoteSubscription(user.id).catch(() => null),
    ]);
    store.update((draft) => {
      draft.auth = { mode: 'authenticated', userId: user.id };
      draft.preferences.hasStarted = true;
      draft.profile.email = user.email ?? draft.profile.email;
      draft.profile.name = user.user_metadata?.full_name ?? draft.profile.name;
      if (remote) {
        draft.answers = { ...draft.answers, ...remote.answers };
        draft.favorites = [...new Set([...draft.favorites, ...remote.favorites])];
        draft.savedConcursos = [...new Set([...draft.savedConcursos, ...remote.savedConcursos])];
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
