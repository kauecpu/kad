import type { CheckoutProgress, Subscription } from '../types/domain.ts';
import { subscriptionHasAccess, subscriptionPlanName } from './subscription.ts';

export type CheckoutFeedback = {
  tone: 'success' | 'warning' | 'danger';
  iconName: string;
  title: string;
  message: string;
  canRetry: boolean;
};

export function checkoutFeedbackFor(
  progress: CheckoutProgress | null,
  subscription: Subscription
): CheckoutFeedback | null {
  if (!progress) return null;
  if (progress.status === 'approved' && subscriptionHasAccess(subscription)) {
    return {
      tone: 'success',
      iconName: 'Check',
      title: 'Pagamento confirmado',
      message: `Seu acesso ${subscriptionPlanName(subscription.plan)} foi atualizado.`,
      canRetry: false,
    };
  }
  if (progress.status === 'approved') {
    return {
      tone: 'warning',
      iconName: 'LoaderCircle',
      title: 'Pagamento confirmado',
      message: 'A cobrança foi confirmada. Estamos concluindo a liberação do acesso.',
      canRetry: true,
    };
  }
  if (progress.reason === 'payment_refunded') {
    return {
      tone: 'danger',
      iconName: 'RotateCcw',
      title: 'Pagamento estornado',
      message: 'O Mercado Pago confirmou o estorno e encerrou o acesso ligado a essa cobrança.',
      canRetry: false,
    };
  }
  if (progress.reason === 'payment_chargeback') {
    return {
      tone: 'danger',
      iconName: 'TriangleAlert',
      title: 'Pagamento contestado',
      message: 'O Mercado Pago informou uma contestação e encerrou o acesso ligado a essa cobrança.',
      canRetry: false,
    };
  }
  if (progress.status === 'expired') {
    return {
      tone: 'warning', iconName: 'Clock3', title: 'Checkout expirado',
      message: 'Inicie uma nova tentativa quando quiser continuar.', canRetry: false,
    };
  }
  if (progress.status === 'canceled' || progress.reason === 'subscription_canceled') {
    return {
      tone: 'warning', iconName: 'CircleX', title: 'Checkout cancelado',
      message: 'Nenhuma nova cobrança foi confirmada.', canRetry: false,
    };
  }
  if (
    progress.reason === 'configuration_missing' ||
    progress.reason === 'provider_credentials_rejected'
  ) {
    return {
      tone: 'danger', iconName: 'TriangleAlert', title: 'Pagamento indisponível neste ambiente',
      message: 'A equipe do KAD precisa concluir a configuração do pagamento.', canRetry: false,
    };
  }
  if (
    progress.status === 'unavailable' ||
    progress.reason === 'provider_rate_limited' ||
    progress.reason === 'provider_unavailable' ||
    progress.reason === 'internal_error'
  ) {
    return {
      tone: 'warning', iconName: 'CloudOff', title: 'Não foi possível atualizar agora',
      message: 'Não conseguimos confirmar o estado atual. Tente consultar o pagamento novamente.', canRetry: true,
    };
  }
  if (progress.status === 'failed') {
    return {
      tone: 'danger', iconName: 'CircleX', title: 'Pagamento não aprovado',
      message: 'Seu plano não foi alterado. Tente novamente ou use outra forma de pagamento.', canRetry: false,
    };
  }
  if (progress.status === 'pending') {
    return {
      tone: 'warning', iconName: 'Clock3', title: 'Aguardando pagamento',
      message: 'O Mercado Pago ainda não confirmou a cobrança.', canRetry: true,
    };
  }
  return {
    tone: 'warning',
    iconName: 'LoaderCircle',
    title: progress.status === 'creating' ? 'Preparando checkout' : 'Confirmando pagamento',
    message: 'Consultando o estado seguro no servidor.',
    canRetry: false,
  };
}
