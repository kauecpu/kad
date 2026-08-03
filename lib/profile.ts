import type { UserProfile } from '@/types';

const LEGACY_DEMO_PROFILE: UserProfile = {
  name: 'Ana Beatriz Moreira',
  email: 'ana.moreira@email.com',
  phone: '(11) 98877-1234',
  city: 'São Paulo, SP',
  targetRole: 'Analista Judiciário',
};

/** Aplica progressivamente a máscara brasileira de celular/telefone. */
export function formatBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Normaliza o identificador público enquanto o usuário digita. */
export function normalizeUsername(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(value);
}

/** Remove somente os campos fictícios gravados por versões antigas no perfil do visitante. */
export function sanitizeLegacyGuestProfile(profile?: Partial<UserProfile>): Partial<UserProfile> {
  if (profile?.email?.trim().toLowerCase() !== LEGACY_DEMO_PROFILE.email) return profile ?? {};

  return {
    ...profile,
    name: profile.name === LEGACY_DEMO_PROFILE.name ? 'Visitante' : profile.name,
    email: '',
    phone: profile.phone === LEGACY_DEMO_PROFILE.phone ? undefined : profile.phone,
    city: profile.city === LEGACY_DEMO_PROFILE.city ? undefined : profile.city,
    targetRole:
      profile.targetRole === LEGACY_DEMO_PROFILE.targetRole ? undefined : profile.targetRole,
  };
}
