import { createClient, type User } from '@supabase/supabase-js';
import { resolvePublicSupabaseConfig } from '@/contracts/deployment-environment.ts';
import { parseRecoveryCallback } from '../core/auth-callback.ts';
import { createPasswordSecurity } from '../core/password-security.ts';
import type {
  AlternativeId,
  BillingCycle,
  Concurso,
  Question,
  SiteAnswer,
  Subscription,
} from '../types/domain.ts';

type OfflineResult = { ok: false; offline: true; message?: never };
type FailureResult = { ok: false; message: string; offline?: false };
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

const publicSupabaseConfig = resolvePublicSupabaseConfig({
  environment: import.meta.env.VITE_KAD_ENV,
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
const url = publicSupabaseConfig.ok ? publicSupabaseConfig.value.url : undefined;
const publishableKey = publicSupabaseConfig.ok
  ? publicSupabaseConfig.value.publishableKey
  : undefined;

export const supabaseConfigured = publicSupabaseConfig.ok;

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        experimental: { appendPkceFlowIdToRedirects: true },
      },
    })
  : null;

const passwordSecurity = supabase ? createPasswordSecurity(supabase.auth) : null;

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, offline: true };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return error
    ? { ok: false, message: 'Não foi possível entrar. Confira seus dados e tente novamente.' }
    : { ok: true, user: data.user };
}

export async function signUp({ name, email, password }: { name: string; email: string; password: string }): Promise<SignUpResult> {
  if (!supabase) return { ok: false, offline: true };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  return error
    ? { ok: false, message: 'Não foi possível criar a conta agora.' }
    : { ok: true, user: data.user, requiresConfirmation: !data.session, authenticated: Boolean(data.session) };
}

export async function verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, offline: true };
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  return error || !data.user
    ? { ok: false, message: 'Código inválido ou expirado. Solicite um novo envio.' }
    : { ok: true, user: data.user };
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

export async function loadRemoteStudyData(userId: string): Promise<RemoteStudyData> {
  if (!supabase) return { answers: {}, favorites: [], savedConcursos: [] };
  const [attempts, favorites, concursos] = await Promise.all([
    supabase
      .from('question_attempts')
      .select('question_id, subject, selected, is_correct, answered_at')
      .eq('user_id', userId),
    supabase.from('question_favorites').select('question_id').eq('user_id', userId),
    supabase.from('saved_concursos').select('concurso_id').eq('user_id', userId),
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
  if (!supabase) return;
  const { error } = await supabase.rpc('record_question_attempt', {
    p_question_id: questionId,
    p_selected: selected,
  });
  if (error) throw error;
}

export async function removeRemoteAnswer(userId: string, questionId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('question_attempts')
    .delete()
    .eq('user_id', userId)
    .eq('question_id', questionId);
  if (error) throw error;
}

export async function setRemoteFavorite(userId: string, questionId: string, favorite: boolean): Promise<void> {
  if (!supabase) return;
  const result = favorite
    ? await supabase.from('question_favorites').upsert({ user_id: userId, question_id: questionId })
    : await supabase.from('question_favorites').delete().eq('user_id', userId).eq('question_id', questionId);
  if (result.error) throw result.error;
}

export async function setRemoteSavedConcurso(userId: string, concursoId: string, saved: boolean): Promise<void> {
  if (!supabase) return;
  const result = saved
    ? await supabase.from('saved_concursos').upsert({ user_id: userId, concurso_id: concursoId })
    : await supabase.from('saved_concursos').delete().eq('user_id', userId).eq('concurso_id', concursoId);
  if (result.error) throw result.error;
}

export async function loadRemoteSubscription(userId: string): Promise<Subscription | null> {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
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
  if (!supabase) return { ok: false, offline: true };
  const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
    body: { plan: 'diamond', billingCycle },
  });
  if (error || !trustedCheckoutUrl(data?.checkoutUrl)) {
    return { ok: false, message: 'Não foi possível abrir o pagamento agora.' };
  }
  return { ok: true, checkoutUrl: data.checkoutUrl };
}

export async function cancelRemoteSubscription(): Promise<OfflineResult | FailureResult | SuccessResult> {
  if (!supabase) return { ok: false, offline: true };
  const { error } = await supabase.functions.invoke('cancel-subscription', { body: {} });
  return error
    ? { ok: false, message: 'Não foi possível cancelar a renovação agora.' }
    : { ok: true };
}

export async function requestPasswordRecovery(email: string): Promise<OfflineResult | FailureResult | SuccessResult> {
  if (!supabase) return { ok: false, offline: true };
  const redirectTo = new URL('/nova-senha', globalThis.location.origin).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return error
    ? { ok: false, message: 'Não foi possível enviar as instruções agora.' }
    : { ok: true };
}

export async function completePasswordRecoveryCallback(callbackUrl: string): Promise<AuthResult> {
  if (!supabase || !passwordSecurity) return { ok: false, offline: true };
  const callback = parseRecoveryCallback(callbackUrl, globalThis.location.origin);
  if (!callback) return { ok: false, message: 'Este link não é válido ou não foi iniciado neste navegador.' };
  const session = await passwordSecurity.completeRecovery(callback);
  return session
    ? { ok: true, user: session.user }
    : { ok: false, message: 'Este link expirou ou já foi utilizado.' };
}

export async function updateRecoveredPassword(
  password: string,
): Promise<OfflineResult | FailureResult | SuccessResult> {
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
  if (!passwordSecurity) return { ok: false, offline: true };
  const result = await passwordSecurity.updateAuthenticated(currentPassword, password);
  if (result.ok) return result;
  if (result.reason === 'current-password-required') return { ok: false, message: 'Informe sua senha atual.' };
  if (result.reason === 'session-required') return { ok: false, message: 'Entre novamente para alterar sua senha.' };
  return { ok: false, message: 'Senha atual incorreta ou sessão expirada.' };
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
}

export async function loadPublishedContent(): Promise<PublishedContent> {
  if (!supabase) return { questions: [], concursos: [] };
  const [questionsResult, concursosResult] = await Promise.all([
    supabase
      .from('questions')
      .select(`
        id, discipline, subject, topic, board, year, role, institution, concurso,
        level, difficulty, statement, alternatives, correct, explanation
      `)
      .eq('publication_status', 'published')
      .order('updated_at', { ascending: false }),
    supabase
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
    questions: (questionsResult.data ?? []) as unknown as Question[],
    concursos: (concursosResult.data ?? []).map((item) => ({
      id: item.id,
      shortName: item.short_name,
      icon: item.icon,
      iconColor: item.icon_color,
      organ: item.organ,
      title: item.title,
      board: item.board,
      state: item.state,
      city: item.city,
      region: item.region,
      levels: item.levels ?? [],
      vacancies: item.vacancies,
      salaryMin: item.salary_min,
      salaryMax: item.salary_max,
      registrationStart: item.registration_start,
      registrationEnd: item.registration_end,
      examDate: item.exam_date,
      fee: item.fee,
      status: item.status,
      roles: (item.concurso_roles ?? [])
        .sort((left, right) => left.sort_order - right.sort_order)
        .map(({ name, vacancies, salary, level }) => ({ name, vacancies, salary, level })),
      highlights: item.highlights ?? [],
      editalUrl: item.edital_url,
      updatedAt: item.updated_at,
      contentSource: 'published' as const,
    })),
  };
}

export async function sendFeedback(payload: { kind: string; message: string }): Promise<OfflineResult | FailureResult | SuccessResult> {
  if (!supabase) return { ok: false, offline: true };
  const { error } = await supabase.rpc('submit_user_feedback', {
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
