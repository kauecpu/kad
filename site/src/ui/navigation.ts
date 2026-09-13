export type NavigationItem = {
  href: string;
  label: string;
  icon: string;
};

export type NavigationGroup = {
  id: 'study' | 'prepare' | 'track' | 'account';
  label: string;
  items: readonly NavigationItem[];
};

export type NavigationExperienceId = 'home' | NavigationGroup['id'];

export type NavigationExperience = NavigationItem & {
  id: NavigationExperienceId;
  description: string;
};

export const homeNavigationItem: NavigationItem = {
  href: '/inicio',
  label: 'Início',
  icon: 'Home',
};

export const navigationGroups: readonly NavigationGroup[] = [
  {
    id: 'study',
    label: 'Estudar',
    items: [
      { href: '/questoes', label: 'Questões', icon: 'BookOpen' },
      { href: '/simulados', label: 'Simulados', icon: 'Timer' },
      { href: '/trilhas', label: 'Trilhas', icon: 'Compass' },
    ],
  },
  {
    id: 'prepare',
    label: 'Preparar',
    items: [
      { href: '/concursos', label: 'Concursos', icon: 'Building2' },
      { href: '/redacao', label: 'Redação', icon: 'PenLine' },
      { href: '/flashcards', label: 'Flashcards', icon: 'Layers3' },
      { href: '/biblioteca', label: 'Biblioteca', icon: 'Library' },
    ],
  },
  {
    id: 'track',
    label: 'Acompanhar',
    items: [
      { href: '/ranking', label: 'Ranking', icon: 'Trophy' },
    ],
  },
  {
    id: 'account',
    label: 'Conta',
    items: [
      { href: '/perfil', label: 'Perfil', icon: 'UserRound' },
      { href: '/configuracoes', label: 'Configurações', icon: 'Settings' },
    ],
  },
] as const;

export const navigationExperiences: readonly NavigationExperience[] = [
  { id: 'home', ...homeNavigationItem, description: 'Visão geral e continuidade' },
  { id: 'study', href: '/questoes', label: 'Estudar', icon: 'BookOpen', description: 'Questões, simulados e trilhas' },
  { id: 'prepare', href: '/concursos', label: 'Preparar', icon: 'Target', description: 'Concursos, redação e acervo' },
  { id: 'track', href: '/ranking', label: 'Acompanhar', icon: 'ChartNoAxesCombined', description: 'Progresso e classificação' },
  { id: 'account', href: '/perfil', label: 'Conta', icon: 'UserRound', description: 'Perfil e preferências' },
] as const;

export function navigationExperienceForPathname(pathname: string): NavigationExperience {
  if (pathname === '/inicio') return navigationExperiences[0];
  if (/^\/(questoes|simulados|trilhas)(\/|$)/.test(pathname)) return navigationExperiences[1];
  if (/^\/(concursos|redacao|flashcards|biblioteca)(\/|$)/.test(pathname)) return navigationExperiences[2];
  if (/^\/(ranking)(\/|$)/.test(pathname)) return navigationExperiences[3];
  if (/^\/(perfil|configuracoes|meta)(\/|$)/.test(pathname)) return navigationExperiences[4];
  return navigationExperiences[0];
}

export function isNavigationGroupActive(groupId: NavigationGroup['id'], pathname: string): boolean {
  return navigationExperienceForPathname(pathname).id === groupId;
}

export function isNavigationItemActive(href: string, pathname: string): boolean {
  if (href === '/inicio') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
