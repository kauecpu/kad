import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { resolvePublicSupabaseConfig } from '@/contracts/deployment-environment.ts';
import { parseRecoveryCallback } from '../core/auth-callback.ts';
import { signOutLocally } from '../core/auth-actions.ts';
import { buildSignupMetadata } from '../core/auth-profile.ts';
import { isEssayDocument, isSimulationSession } from '../core/user-sync.ts';
import { createPasswordSecurity } from '../core/password-security.ts';
import { mapPublishedConcursos, mapPublishedQuestions } from './published-content.ts';
import type {
  AlternativeId,
  BillingCycle,
  CheckoutProgress,
  Concurso,
  EssayDocument,
  Flashcard,
  FlashcardDeck,
  FlashcardReview,
  Question,
  SiteComment,
  SiteCommunityAccuracy,
  SiteSimulationSession,
  SiteAnswer,
  Subscription,
} from '../types/domain.ts';

type OfflineResult = { ok: false; offline: true; message?: never };
type FailureResult = { ok: false; message: string; code?: string; offline?: false };
type SuccessResult = { ok: true; offline?: false };
type AuthResult = OfflineResult | FailureResult | (SuccessResult & { user: User });
type SignUpResult = OfflineResult | FailureResult | (SuccessResult & {
  user: User | null;
  requiresConfirmation: boolean;
  authenticated: boolean;
});
type CheckoutResult = OfflineResult | FailureResult | (SuccessResult & { checkoutUrl: string });

export type RemoteStudyData = {
  answers: Record<string, SiteAnswer>;
  favorites: string[];
  savedConcursos: string[];
};

export type PublishedContent = { questions: Question[]; concursos: Concurso[] };

export type RemoteProfile = {
  name: string;
  username: string;
  phone: string;
  city: string;
  targetRole: string;
  avatarUri?: string;
};

export type RemoteFlashcards = {
  decks: FlashcardDeck[];
  cards: Flashcard[];
  reviews: FlashcardReview[];
};

let supabase: SupabaseClient | null = null;
let passwordSecurity: ReturnType<typeof createPasswordSecurity> | null = null;
let initialization: Promise<boolean> | null = null;
export let supabaseConfigured = false;

function createBrowserClient(url: string, publishableKey: string): SupabaseClient {
  return createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        experimental: { appendPkceFlowIdToRedirects: true },
      },
    });
}

export function initializeSupabase(): Promise<boolean> {
  if (initialization) return initialization;
  initialization = (async () => {
    let resolved = resolvePublicSupabaseConfig({
      environment: import.meta.env.VITE_KAD_ENV,
      url: import.meta.env.VITE_SUPABASE_URL,
      publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
    if (!resolved.ok && typeof globalThis.fetch === 'function') {
      try {
        const response = await globalThis.fetch('/api/public-config', {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (response.ok) {
          const runtime = await response.json() as Record<string, unknown>;
          resolved = resolvePublicSupabaseConfig({
            environment: typeof runtime.environment === 'string' ? runtime.environment : undefined,
            url: typeof runtime.url === 'string' ? runtime.url : undefined,
            publishableKey: typeof runtime.publishableKey === 'string' ? runtime.publishableKey : undefined,
          });
        }
      } catch {
        // O catálogo local continua disponível quando a configuração hospedada não responde.
      }
    }
    if (!resolved.ok) return false;
    supabase = createBrowserClient(resolved.value.url, resolved.value.publishableKey);
    passwordSecurity = createPasswordSecurity(supabase.auth);
    supabaseConfigured = true;
    return true;
  })();
  return initialization;
}

async function client(): Promise<SupabaseClient | null> {
  await initializeSupabase();
  return supabase;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const remote = await client();
  if (!remote) return { ok: false, offline: true };
  const { data, error } = await remote.auth.signInWithPassword({ email, password });
  return error
    ? { ok: false, message: 'Não foi possível entrar. Confira seus dados e tente novamente.' }
    : { ok: true, user: data.user };
}

export async function signUp({ name, email, password }: { name: string; email: string; password: string }): Promise<SignUpResult> {
  const remote = await client();
  if (!remote) return { ok: false, offline: true };
  const { data, error } = await remote.auth.signUp({
    email,
    password,
    options: { data: buildSignupMetadata(name) },
  });
  return error
    ? { ok: false, message: 'Não foi possível criar a conta agora.' }
    : { ok: true, user: data.user, requiresConfirmation: !data.session, authenticated: Boolean(data.session) };
}

export async function verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
  const remote = await client();
  if (!remote) return { ok: false, offline: true };
  const { data, error } = await remote.auth.verifyOtp({ email, token, type: 'signup' });
  return error || !data.user
    ? { ok: false, message: 'Código inválido ou expirado. Solicite um novo envio.' }
    : { ok: true, user: data.user };
}

export async function resendEmailConfirmation(email: string): Promise<OfflineResult | FailureResult | SuccessResult> {
  const remote = await client();
  if (!remote) return { ok: false, offline: true };
  const { error } = await remote.auth.resend({ type: 'signup', email });
  return error
    ? { ok: false, message: 'Não foi possível reenviar o código agora.' }
    : { ok: true };
}

export async function getCurrentUser(): Promise<User | null> {
  const remote = await client();
  if (!remote) return null;
  const { data, error } = await remote.auth.getUser();
  return error ? null : data.user;
}

export async function loadRemoteStudyData(userId: string): Promise<RemoteStudyData> {
  const remote = await client();
  if (!remote) return { answers: {}, favorites: [], savedConcursos: [] };
  const [attempts, favorites, concursos] = await Promise.all([
    remote
      .from('question_attempts')
      .select('question_id, subject, selected, is_correct, answered_at')
      .eq('user_id', userId),
    remote.from('question_favorites').select('question_id').eq('user_id', userId),
    remote.from('saved_concursos').select('concurso_id').eq('user_id', userId),
  ]);
  const error = attempts.error ?? favorites.error ?? concursos.error;
  if (error) throw error;
  return {
    answers: Object.fromEntries((attempts.data ?? []).map((item) => [item.question_id, {
      questionId: item.question_id,
      subject: item.subject,
      selected: item.selected,
      isCorrect: item.is_correct,
      answeredAt: item.answered_at,
    }])),
    favorites: (favorites.data ?? []).map((item) => item.question_id),
    savedConcursos: (concursos.data ?? []).map((item) => item.concurso_id),
  };
}

export async function saveRemoteAnswer(questionId: string, selected: AlternativeId): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote.rpc('record_question_attempt', {
    p_question_id: questionId,
    p_selected: selected,
  });
  if (error) throw error;
}

export async function recordRemoteLevelActivity(userId: string, event: Record<string, unknown> | null): Promise<{ totalXp: number }> {
  const remote = await client();
  if (!remote) throw new Error('XP indisponível');
  const { data: auth } = await remote.auth.getSession();
  if (auth.session?.user.id !== userId) throw new Error('A conta mudou durante a sincronização.');
  const { data, error } = await remote.rpc('record_level_activity', { p_event: event });
  if (error) throw error;
  if (!data || !Number.isSafeInteger(data.totalXp) || data.totalXp < 0) throw new Error('Resposta de XP inválida.');
  return { totalXp: data.totalXp };
}

export async function removeRemoteAnswer(userId: string, questionId: string): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote
    .from('question_attempts')
    .delete()
    .eq('user_id', userId)
    .eq('question_id', questionId);
  if (error) throw error;
}

export async function setRemoteFavorite(userId: string, questionId: string, favorite: boolean): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const result = favorite
    ? await remote.from('question_favorites').upsert({ user_id: userId, question_id: questionId })
    : await remote.from('question_favorites').delete().eq('user_id', userId).eq('question_id', questionId);
  if (result.error) throw result.error;
}

export async function setRemoteSavedConcurso(userId: string, concursoId: string, saved: boolean): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const result = saved
    ? await remote.from('saved_concursos').upsert({ user_id: userId, concurso_id: concursoId })
    : await remote.from('saved_concursos').delete().eq('user_id', userId).eq('concurso_id', concursoId);
  if (result.error) throw result.error;
}

export async function loadRemoteSubscription(userId: string): Promise<Subscription | null> {
  const remote = await client();
  if (!remote || !userId) return null;
  const { data, error } = await remote
    .from('subscriptions')
    .select('plan, billing_cycle, provider, status, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { plan: 'basic', status: 'inactive', autoRenew: false };
  const plan: Subscription['plan'] = data.plan === 'diamond' || data.plan === 'circle' ? data.plan : 'basic';
  const billingCycle: BillingCycle | undefined = ['monthly', 'quarterly', 'annual'].includes(data.billing_cycle)
    ? data.billing_cycle as BillingCycle
    : undefined;
  const provider: Subscription['provider'] = ['mercado_pago', 'apple', 'google'].includes(data.provider)
    ? data.provider as Subscription['provider']
    : undefined;
  const status: Subscription['status'] = ['active', 'inactive', 'past_due', 'canceled', 'expired'].includes(data.status)
    ? data.status as Subscription['status']
    : 'inactive';
  return {
    plan,
    billingCycle,
    provider,
    status,
    renewsAt: data.current_period_end ?? undefined,
    autoRenew: !data.cancel_at_period_end,
  };
}

function trustedCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const checkout = new URL(value);
    const host = checkout.hostname.toLocaleLowerCase('en-US');
    return checkout.protocol === 'https:' && (
      host === 'mercadopago.com'
      || host.endsWith('.mercadopago.com')
      || host === 'mercadopago.com.br'
      || host.endsWith('.mercadopago.com.br')
    );
  } catch {
    return false;
  }
}

export async function createSubscriptionCheckout(billingCycle: BillingCycle): Promise<CheckoutResult> {
  const remote = await client();
  if (!remote) return { ok: false, offline: true };
  const { data, error } = await remote.functions.invoke('create-payment-checkout', {
    body: { plan: 'diamond', billingCycle },
  });
  if (error || !trustedCheckoutUrl(data?.checkoutUrl)) {
    let code: string | undefined;
    const context = typeof error === 'object' && error !== null && 'context' in error
      ? error.context
      : null;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { code?: unknown } | null;
      if (typeof payload?.code === 'string') code = payload.code;
    }
    const message = code === 'server_not_configured'
      ? 'O pagamento não está configurado neste ambiente.'
      : code === 'checkout_in_progress'
        ? 'Já existe um checkout sendo preparado. Aguarde alguns segundos.'
        : code === 'checkout_rate_limited'
          ? 'Muitas tentativas seguidas. Aguarde um pouco e tente novamente.'
          : code === 'subscription_active'
            ? 'Sua assinatura já possui acesso ativo.'
            : 'Não foi possível abrir o pagamento agora.';
    return { ok: false, message, code };
  }
  return { ok: true, checkoutUrl: data.checkoutUrl };
}

export async function loadRemoteCheckoutStatus(checkoutId: string): Promise<CheckoutProgress | null> {
  const remote = await client();
  if (!remote || !checkoutId) return null;
  const { data, error } = await remote.rpc('get_payment_checkout_status', {
    p_checkout_id: checkoutId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !['creating', 'pending', 'approved', 'failed', 'canceled', 'expired'].includes(row.status)) {
    return null;
  }
  return {
    status: row.status as CheckoutProgress['status'],
    reason: typeof row.status_reason === 'string' ? row.status_reason : null,
  };
}

export async function cancelRemoteSubscription(): Promise<OfflineResult | FailureResult | SuccessResult> {
  const remote = await client();
  if (!remote) return { ok: false, offline: true };
  const { error } = await remote.functions.invoke('cancel-subscription', { body: {} });
  return error
    ? { ok: false, message: 'Não foi possível cancelar a renovação agora.' }
    : { ok: true };
}

export async function requestPasswordRecovery(email: string): Promise<OfflineResult | FailureResult | SuccessResult> {
  const remote = await client();
  if (!remote) return { ok: false, offline: true };
  const redirectTo = new URL('/nova-senha', globalThis.location.origin).toString();
  const { error } = await remote.auth.resetPasswordForEmail(email, { redirectTo });
  return error
    ? { ok: false, message: 'Não foi possível enviar as instruções agora.' }
    : { ok: true };
}

export async function completePasswordRecoveryCallback(callbackUrl: string): Promise<AuthResult> {
  await initializeSupabase();
  if (!passwordSecurity) return { ok: false, offline: true };
  const callback = parseRecoveryCallback(callbackUrl, globalThis.location.origin);
  if (!callback) return { ok: false, message: 'Este link não é válido ou não foi iniciado neste navegador.' };
  const session = await passwordSecurity.completeRecovery(callback);
  if (!session) return { ok: false, message: 'Este link expirou ou já foi utilizado.' };
  const user = await getCurrentUser();
  return user
    ? { ok: true, user }
    : { ok: false, message: 'Não foi possível confirmar a conta recuperada.' };
}

export async function updateRecoveredPassword(
  password: string,
): Promise<OfflineResult | FailureResult | SuccessResult> {
  await initializeSupabase();
  if (!passwordSecurity) return { ok: false, offline: true };
  const result = await passwordSecurity.updateRecovered(password);
  return result.ok
    ? result
    : { ok: false, message: result.reason === 'recovery-not-validated'
      ? 'Valide um novo link de recuperação antes de alterar a senha.'
      : 'Não foi possível atualizar a senha agora.' };
}

export async function updateAccountPassword(
  currentPassword: string,
  password: string,
): Promise<OfflineResult | FailureResult | SuccessResult> {
  await initializeSupabase();
  if (!passwordSecurity) return { ok: false, offline: true };
  const result = await passwordSecurity.updateAuthenticated(currentPassword, password);
  if (result.ok) return result;
  if (result.reason === 'current-password-required') return { ok: false, message: 'Informe sua senha atual.' };
  if (result.reason === 'session-required') return { ok: false, message: 'Entre novamente para alterar sua senha.' };
  return { ok: false, message: 'Senha atual incorreta ou sessão expirada.' };
}

export async function signOut(): Promise<void> {
  const remote = await client();
  if (remote) await signOutLocally(remote.auth);
}

function avatarUrl(remote: SupabaseClient, path?: string | null, version?: string | null): string | undefined {
  if (!path) return undefined;
  const { data } = remote.storage.from('profile-avatars').getPublicUrl(path);
  return version ? `${data.publicUrl}?v=${encodeURIComponent(version)}` : data.publicUrl;
}

export async function loadRemoteProfile(userId: string): Promise<RemoteProfile | null> {
  const remote = await client();
  if (!remote) return null;
  const { data, error } = await remote
    .from('profiles')
    .select('name, username, phone, city, target_role, avatar_path, updated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    name: data.name ?? '',
    username: data.username ?? '',
    phone: data.phone ?? '',
    city: data.city ?? '',
    targetRole: data.target_role ?? '',
    avatarUri: avatarUrl(remote, data.avatar_path, data.updated_at),
  };
}

export async function saveRemoteProfile(
  userId: string,
  profile: Pick<RemoteProfile, 'name' | 'phone' | 'city' | 'targetRole'>,
): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote.from('profiles').upsert({
    id: userId,
    name: profile.name,
    phone: profile.phone || null,
    city: profile.city || null,
    target_role: profile.targetRole || null,
  });
  if (error) throw error;
}

export async function uploadRemoteAvatar(userId: string, file: File): Promise<string> {
  const remote = await client();
  if (!remote) throw new Error('Conexão com a conta indisponível.');
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem pode ter no máximo 5 MB.');
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/avatar.${extension}`;
  const current = await remote.from('profiles').select('avatar_path').eq('id', userId).maybeSingle();
  if (current.error) throw current.error;
  const upload = await remote.storage.from('profile-avatars').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: true,
  });
  if (upload.error) throw upload.error;
  const profile = await remote.from('profiles').update({ avatar_path: path }).eq('id', userId).select('updated_at').single();
  if (profile.error) throw profile.error;
  if (current.data?.avatar_path && current.data.avatar_path !== path) {
    await remote.storage.from('profile-avatars').remove([current.data.avatar_path]).catch(() => undefined);
  }
  return avatarUrl(remote, path, profile.data.updated_at) ?? '';
}

export async function loadRemoteEssayDocuments(userId: string): Promise<EssayDocument[]> {
  const remote = await client();
  if (!remote) return [];
  const { data, error } = await remote
    .from('essay_documents')
    .select('topic_id, content, elapsed_seconds, status, submitted_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    topicId: row.topic_id,
    content: row.content,
    elapsedSeconds: row.elapsed_seconds,
    status: row.status,
    submittedAt: row.submitted_at ?? undefined,
    updatedAt: row.updated_at,
  })).filter(isEssayDocument);
}

export async function saveRemoteEssay(userId: string, document: EssayDocument): Promise<void> {
  const remote = await client();
  if (!remote || !isEssayDocument(document)) return;
  const { error } = await remote.rpc('sync_essay_document', {
    p_user_id: userId,
    p_topic_id: document.topicId,
    p_content: document.content,
    p_elapsed_seconds: document.elapsedSeconds,
    p_status: document.status,
    p_submitted_at: document.status === 'submitted' ? document.submittedAt ?? document.updatedAt : null,
    p_updated_at: document.updatedAt,
  });
  if (error) throw error;
}

export async function loadRemoteSimulationSessions(userId: string): Promise<SiteSimulationSession[]> {
  const remote = await client();
  if (!remote) return [];
  const { data, error } = await remote
    .from('simulation_sessions')
    .select('payload, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? [])
    .map((row) => ({ ...(row.payload as SiteSimulationSession), updatedAt: row.updated_at }))
    .filter(isSimulationSession);
}

export async function saveRemoteSimulationSession(userId: string, session: SiteSimulationSession): Promise<void> {
  const remote = await client();
  if (!remote || !isSimulationSession(session)) return;
  const payload = { ...session, updatedAt: session.updatedAt ?? new Date().toISOString() };
  const { error } = await remote.rpc('sync_simulation_session', {
    p_user_id: userId,
    p_session_id: session.id,
    p_status: session.status,
    p_payload: payload,
    p_created_at: session.createdAt,
    p_completed_at: session.status === 'completed' ? session.completedAt : null,
    p_updated_at: payload.updatedAt,
  });
  if (error) throw error;
}

export async function deleteRemoteSimulationSession(userId: string, sessionId: string): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote.from('simulation_sessions').delete().eq('user_id', userId).eq('session_id', sessionId);
  if (error) throw error;
}

function deckRow(deck: FlashcardDeck) {
  return {
    id: deck.id,
    user_id: deck.userId,
    name: deck.name,
    description: deck.description ?? null,
    color: deck.color ?? null,
    archived_at: deck.archivedAt ?? null,
    created_at: deck.createdAt,
    updated_at: deck.updatedAt,
  };
}

function cardRow(card: Flashcard) {
  return {
    id: card.id,
    user_id: card.userId,
    deck_id: card.deckId,
    front: card.front,
    back: card.back,
    tags: card.tags,
    state: card.state,
    repetitions: card.repetitions,
    interval_days: card.intervalDays,
    ease_factor: card.easeFactor,
    due_at: card.dueAt,
    archived_at: card.archivedAt ?? null,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  };
}

function reviewRow(review: FlashcardReview) {
  return {
    id: review.id,
    user_id: review.userId,
    card_id: review.cardId,
    rating: review.rating,
    reviewed_at: review.reviewedAt,
    previous_due_at: review.previousDueAt,
    next_due_at: review.nextDueAt,
    created_at: review.reviewedAt,
  };
}

export async function loadRemoteFlashcards(userId: string): Promise<RemoteFlashcards> {
  const remote = await client();
  if (!remote) return { decks: [], cards: [], reviews: [] };
  const [decksResult, cardsResult, reviewsResult] = await Promise.all([
    remote.from('flashcard_decks').select('*').eq('user_id', userId),
    remote.from('flashcards').select('*').eq('user_id', userId),
    remote.from('flashcard_reviews').select('*').eq('user_id', userId),
  ]);
  const error = decksResult.error ?? cardsResult.error ?? reviewsResult.error;
  if (error) throw error;
  const cards = (cardsResult.data ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    deckId: String(row.deck_id),
    front: String(row.front),
    back: String(row.back),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    state: row.state as Flashcard['state'],
    repetitions: Number(row.repetitions),
    intervalDays: Number(row.interval_days),
    easeFactor: Number(row.ease_factor),
    dueAt: String(row.due_at),
    archivedAt: typeof row.archived_at === 'string' ? row.archived_at : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
  return {
    decks: (decksResult.data ?? []).map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name),
      description: typeof row.description === 'string' ? row.description : undefined,
      color: typeof row.color === 'string' ? row.color : undefined,
      cardCount: cards.filter((card) => card.deckId === row.id && !card.archivedAt).length,
      archivedAt: typeof row.archived_at === 'string' ? row.archived_at : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
    cards,
    reviews: (reviewsResult.data ?? []).map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      cardId: String(row.card_id),
      rating: row.rating as FlashcardReview['rating'],
      reviewedAt: String(row.reviewed_at),
      previousDueAt: String(row.previous_due_at),
      nextDueAt: String(row.next_due_at),
    })),
  };
}

export async function saveRemoteDeck(deck: FlashcardDeck): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote.from('flashcard_decks').upsert(deckRow(deck));
  if (error) throw error;
}

export async function saveRemoteCard(card: Flashcard): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote.from('flashcards').upsert(cardRow(card));
  if (error) throw error;
}

export async function saveRemoteReview(review: FlashcardReview): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote.from('flashcard_reviews').upsert(reviewRow(review), {
    onConflict: 'user_id,id',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export async function removeRemoteDeck(userId: string, deckId: string): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote.from('flashcard_decks').delete().eq('user_id', userId).eq('id', deckId);
  if (error) throw error;
}

export async function removeRemoteCard(userId: string, cardId: string): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote.from('flashcards').delete().eq('user_id', userId).eq('id', cardId);
  if (error) throw error;
}

export async function loadQuestionComments(questionId: string, userId: string): Promise<SiteComment[]> {
  const remote = await client();
  if (!remote) return [];
  const comments = await remote
    .from('question_comments')
    .select('id, user_id, author_name, text, likes_count, created_at, updated_at')
    .eq('question_id', questionId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (comments.error) throw comments.error;
  if (!comments.data?.length) return [];
  const likes = await remote.from('comment_likes').select('comment_id').eq('user_id', userId)
    .in('comment_id', comments.data.map((comment) => comment.id));
  if (likes.error) throw likes.error;
  const likedIds = new Set((likes.data ?? []).map((item) => item.comment_id));
  return comments.data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    author: row.author_name,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at !== row.created_at ? row.updated_at : undefined,
    likes: row.likes_count,
    likedByMe: likedIds.has(row.id),
    isOwn: row.user_id === userId,
    synced: true,
  }));
}

export async function createQuestionComment(
  questionId: string,
  userId: string,
  author: string,
  text: string,
): Promise<SiteComment> {
  const remote = await client();
  if (!remote) throw new Error('Conexão indisponível.');
  const { data, error } = await remote.from('question_comments')
    .insert({ question_id: questionId, user_id: userId, author_name: author, text })
    .select('id, user_id, author_name, text, likes_count, created_at, updated_at')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    userId: data.user_id,
    author: data.author_name,
    text: data.text,
    createdAt: data.created_at,
    likes: data.likes_count,
    likedByMe: false,
    isOwn: true,
    synced: true,
  };
}

export async function deleteQuestionComment(commentId: string, userId: string): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote.from('question_comments').delete().eq('id', commentId).eq('user_id', userId);
  if (error) throw error;
}

export async function updateQuestionComment(commentId: string, userId: string, text: string): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const { error } = await remote.from('question_comments').update({ text }).eq('id', commentId).eq('user_id', userId);
  if (error) throw error;
}

export async function setQuestionCommentLiked(commentId: string, userId: string, liked: boolean): Promise<void> {
  const remote = await client();
  if (!remote) return;
  const result = liked
    ? await remote.from('comment_likes').upsert({ comment_id: commentId, user_id: userId })
    : await remote.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);
  if (result.error) throw result.error;
}

export async function loadQuestionCommunityAccuracy(questionId: string): Promise<SiteCommunityAccuracy | null> {
  const remote = await client();
  if (!remote) return null;
  const { data, error } = await remote.rpc('question_community_accuracy', { p_question_ids: [questionId] });
  if (error) throw error;
  const row = data?.[0];
  return row ? { accuracy: Number(row.accuracy), totalAnswers: Number(row.total_answers) } : null;
}

export async function deleteRemoteAccount(currentPassword: string): Promise<OfflineResult | FailureResult | SuccessResult> {
  const remote = await client();
  if (!remote) return { ok: false, offline: true };
  const { error } = await remote.functions.invoke('delete-account', { body: { currentPassword } });
  return error
    ? { ok: false, message: 'Não foi possível excluir a conta. Confira sua senha e tente novamente.' }
    : { ok: true };
}

export async function loadPublishedContent(): Promise<PublishedContent> {
  const remote = await client();
  if (!remote) return { questions: [], concursos: [] };
  const [questionsResult, concursosResult] = await Promise.all([
    remote
      .from('questions')
      .select(`
        id, discipline, subject, topic, board, year, role, institution, concurso,
        level, difficulty, statement, alternatives, correct, explanation
      `)
      .eq('publication_status', 'published')
      .order('updated_at', { ascending: false }),
    remote
      .from('concursos')
      .select(`
        id, short_name, icon, icon_color, organ, title, board, state, city, region, levels,
        vacancies, salary_min, salary_max, registration_start, registration_end,
        exam_date, fee, status, highlights, edital_url, updated_at, source_provider,
        concurso_roles (name, vacancies, salary, level, sort_order)
      `)
      .eq('publication_status', 'published')
      .order('updated_at', { ascending: false }),
  ]);
  if (questionsResult.error || concursosResult.error) throw new Error('published-content-unavailable');
  return {
    questions: mapPublishedQuestions(questionsResult.data),
    concursos: mapPublishedConcursos(concursosResult.data),
  };
}

export async function sendFeedback(payload: { kind: string; message: string }): Promise<OfflineResult | FailureResult | SuccessResult> {
  const remote = await client();
  if (!remote) return { ok: false, offline: true };
  const { error } = await remote.rpc('submit_user_feedback', {
    p_category: payload.kind,
    p_message: payload.message,
    p_source_screen: 'profile/feedback',
    p_platform: 'web',
    p_app_version: 'site-0.1.0',
  });
  return error
    ? { ok: false, message: 'Não foi possível enviar o comentário agora.' }
    : { ok: true };
}
