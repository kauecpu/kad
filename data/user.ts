import type { Subscription, UserProfile } from '@/types';

/** Perfil local usado antes de o visitante informar seus próprios dados. */
export const DEFAULT_PROFILE: UserProfile = {
  name: 'Visitante',
  email: '',
};

export const DEFAULT_SUBSCRIPTION: Subscription = {
  plan: 'basic',
  status: 'inactive',
  autoRenew: false,
};

export const BASIC_DAILY_QUESTION_LIMIT = 10;

export const BASIC_PLAN_ACCESS = [
  { label: 'Até 10 questões por dia', included: true },
  { label: 'Correção e gabarito comentado', included: true },
  { label: 'Concursos salvos para acompanhar', included: true },
  { label: 'Estatísticas de desempenho', included: false },
  { label: 'Simulados por concurso', included: false },
];

export const DIAMOND_BILLING_OPTIONS = [
  {
    id: 'monthly' as const,
    name: 'Mensal',
    price: 14.99,
    period: 'por mês',
    description: 'Cobrança mensal, cancele quando quiser.',
    durationDays: 30,
  },
  {
    id: 'quarterly' as const,
    name: 'Trimestral',
    price: 39.99,
    period: 'a cada 3 meses',
    description: 'Equivale a R$ 13,33 por mês.',
    durationDays: 90,
    badge: 'Economize 11%',
  },
  {
    id: 'annual' as const,
    name: 'Anual',
    price: 149.99,
    period: 'por ano',
    description: 'Equivale a R$ 12,50 por mês.',
    durationDays: 365,
    badge: 'Economize 17%',
  },
];

export const DIAMOND_BENEFITS = [
  'Questões sem limite e gabaritos comentados',
  'Simulados cronometrados por concurso',
  'Desempenho geral e revisão dos erros',
];

export const CIRCLE_BILLING_OPTIONS = [
  {
    id: 'monthly' as const,
    name: 'Mensal',
    originalPrice: 59.96,
    price: 44.97,
    period: 'por mês',
    description: '4 acessos pelo preço de 3.',
    durationDays: 30,
  },
  {
    id: 'quarterly' as const,
    name: 'Trimestral',
    originalPrice: 159.96,
    price: 119.97,
    period: 'a cada 3 meses',
    description: '4 acessos pelo preço de 3.',
    durationDays: 90,
  },
  {
    id: 'annual' as const,
    name: 'Anual',
    originalPrice: 599.96,
    price: 449.97,
    period: 'por ano',
    description: '4 acessos pelo preço de 3.',
    durationDays: 365,
  },
];

export const CIRCLE_BENEFITS = [
  '4 acessos com progresso individual',
  'Todos os recursos do KAD Diamante',
  'Convites gerenciados pelo titular',
];
