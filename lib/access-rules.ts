import type { DailyQuestionUsage, Subscription } from '../types/index.ts';

/** Chave de data local usada pela cota diária, sem conversão para UTC. */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Retorna a cota do dia atual, descartando apenas o contador de dias anteriores. */
export function currentDailyUsage(
  usage?: DailyQuestionUsage,
  now = new Date()
): DailyQuestionUsage {
  const today = localDateKey(now);
  return usage?.date === today ? usage : { date: today, questionIds: [] };
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
 * Expira localmente um plano ativo assim que a renovação passa.
 * Datas sem horário permanecem válidas até o fim do dia informado.
 */
export function subscriptionWithCurrentStatus(
  subscription: Subscription,
  now = new Date()
): Subscription {
  if (subscription.status !== 'active' || !subscription.renewsAt) {
    return subscription;
  }

  const expiresAt = expirationTime(subscription.renewsAt);
  if (expiresAt !== null && now.getTime() >= expiresAt) {
    return { ...subscription, status: 'expired' };
  }

  return subscription;
}

export function canAnswerWithDailyLimit({
  isPremium,
  usage,
  questionId,
  limit,
  now = new Date(),
}: {
  isPremium: boolean;
  usage: DailyQuestionUsage;
  questionId: string;
  limit: number;
  now?: Date;
}): boolean {
  if (isPremium) return true;
  const todayUsage = currentDailyUsage(usage, now);
  return (
    todayUsage.questionIds.includes(questionId) ||
    todayUsage.questionIds.length < limit
  );
}
