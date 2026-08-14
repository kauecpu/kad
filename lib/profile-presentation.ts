export type ProfileHeroAction = {
  label: string;
  description: string;
  href?: '/auth/cadastro' | '/perfil/editar';
};

type ProfileHeroActionInput = {
  isAuthenticated: boolean;
  isAuthConfigured: boolean;
};

export function profileHeroAction({
  isAuthenticated,
  isAuthConfigured,
}: ProfileHeroActionInput): ProfileHeroAction {
  if (isAuthenticated) {
    return {
      label: 'Editar meu perfil',
      description: 'Atualize seus dados e sua meta',
      href: '/perfil/editar',
    };
  }

  if (isAuthConfigured) {
    return {
      label: 'Criar conta e sincronizar',
      description: 'Leve sua preparação para outros aparelhos',
      href: '/auth/cadastro',
    };
  }

  return {
    label: 'Login indisponível',
    description: 'Seus dados continuam salvos neste aparelho',
  };
}
