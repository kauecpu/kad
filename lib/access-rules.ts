import type { DailyQuestionUsage, Subscription } from '../types/index.ts';

/** Chave de data local usada pelas métricas diárias, sem conversão para UTC. */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Retorna a atividade do dia atual, descartando apenas o contador de dias anteriores. */
export function currentDailyUsage(
  usage?: DailyQuestionUsage,
  now = new Date()
): DailyQuestionUsage {
  const today = localDateKey(now);
  return usage?.date === today ? usage : { date: today, questionIds: [] };
}

/** Registra a atividade diária sem limitar a quantidade de questões respondidas. */
export function recordDailyQuestionUsage(
  usage: DailyQuestionUsage,
  questionId: string,
  now = new Date()
): DailyQuestionUsage {
  const current = currentDailyUsage(usage, now);
  return current.questionIds.includes(questionId)
    ? current
    : { ...current, questionIds: [...current.questionIds, questionId] };
}

function expirationTime(renewsAt: string): number | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(renewsAt);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day) + 1).getTime();
  }

  const parsed = new Date(renewsAt).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Expira localmente um plano pago assim que o período já quitado termina.
 * Datas sem horário permanecem válidas até o fim do dia informado.
 */
export function subscriptionWithCurrentStatus(
  subscription: Subscription,
  now = new Date()
): Subscription {
  if (
    !['active', 'past_due', 'canceled'].includes(subscription.status) ||
    !subscription.renewsAt
  ) {
    return subscription;
  }

  const expiresAt = expirationTime(subscription.renewsAt);
  if (expiresAt === null || now.getTime() >= expiresAt) {
    return { ...subscription, status: 'expired' };
  }

  return subscription;
}

/** Acesso premium depende de um período confirmado pelo servidor e ainda vigente. */
export function subscriptionHasAccess(
  subscription: Subscription,
  now = new Date()
): boolean {
  if (subscription.plan === 'basic' || !subscription.renewsAt) return false;
  const current = subscriptionWithCurrentStatus(subscription, now);
  return ['active', 'past_due', 'canceled'].includes(current.status);
}
