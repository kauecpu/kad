export type NavigationItem = {
  href: string;
  label: string;
  icon: string;
};

export type NavigationGroup = {
  id: 'study' | 'prepare' | 'track';
  label: string;
  items: readonly NavigationItem[];
};

export const navigationGroups: readonly NavigationGroup[] = [
  {
    id: 'study',
    label: 'Estudar',
    items: [
      { href: '/inicio', label: 'Início', icon: 'Home' },
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
] as const;

export const mobilePrimaryNavigation: readonly NavigationItem[] = [
  { href: '/inicio', label: 'Início', icon: 'Home' },
  { href: '/questoes', label: 'Questões', icon: 'BookOpen' },
  { href: '/simulados', label: 'Simulados', icon: 'Timer' },
  { href: '/trilhas', label: 'Trilhas', icon: 'Compass' },
] as const;

export const mobileSecondaryNavigation: readonly NavigationItem[] = [
  ...navigationGroups.flatMap((group) => group.items).filter(
    (item) => !mobilePrimaryNavigation.some((primary) => primary.href === item.href),
  ),
  { href: '/perfil', label: 'Perfil', icon: 'User' },
] as const;

export function isNavigationItemActive(href: string, pathname: string): boolean {
  if (href === '/inicio') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMobileMoreActive(pathname: string): boolean {
  return mobileSecondaryNavigation.some((item) => isNavigationItemActive(item.href, pathname));
}
