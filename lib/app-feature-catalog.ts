export type AppFeatureGroupId = 'practice' | 'progress' | 'other' | 'account';

export type AppDrawerGroupId = 'main' | 'progress' | 'study' | 'account';

export type AppFeatureId =
  | 'questions'
  | 'contests'
  | 'simulations'
  | 'ranking'
  | 'trails'
  | 'essay'
  | 'library'
  | 'flashcards'
  | 'profile';

export type AppFeatureIcon =
  | 'home-outline'
  | 'book-outline'
  | 'briefcase-outline'
  | 'timer-outline'
  | 'trophy-outline'
  | 'map-outline'
  | 'create-outline'
  | 'library-outline'
  | 'layers-outline'
  | 'person-outline';

export type AppFeature = {
  id: AppFeatureId;
  group: AppFeatureGroupId;
  title: string;
  description: string;
  href:
    | '/questoes'
    | '/concursos'
    | '/simulados'
    | '/ranking'
    | '/trilhas'
    | '/redacao'
    | '/biblioteca'
    | '/flashcards'
    | '/perfil';
  icon: AppFeatureIcon;
  presentation: 'card' | 'row';
};

export const APP_ROUTE_ALIASES = {
  rank: '/ranking',
} as const;

export const APP_FEATURE_GROUPS = [
  { id: 'practice', title: 'Praticar' },
  { id: 'progress', title: 'Acompanhar' },
  { id: 'other', title: 'Outras formas de estudar' },
  { id: 'account', title: 'Conta' },
] as const satisfies ReadonlyArray<{ id: AppFeatureGroupId; title: string }>;

export const APP_FEATURES = [
  {
    id: 'questions',
    group: 'practice',
    title: 'Questões',
    description: 'Pratique por disciplina, assunto ou concurso',
    href: '/questoes',
    icon: 'book-outline',
    presentation: 'card',
  },
  {
    id: 'contests',
    group: 'practice',
    title: 'Concursos',
    description: 'Veja concursos abertos, previstos e salvos',
    href: '/concursos',
    icon: 'briefcase-outline',
    presentation: 'card',
  },
  {
    id: 'simulations',
    group: 'practice',
    title: 'Simulados',
    description: 'Treine ritmo e formato de prova',
    href: '/simulados',
    icon: 'timer-outline',
    presentation: 'card',
  },
  {
    id: 'ranking',
    group: 'progress',
    title: 'Ranking',
    description: 'Acompanhe sua pontuação e posição',
    href: '/ranking',
    icon: 'trophy-outline',
    presentation: 'card',
  },
  {
    id: 'trails',
    group: 'other',
    title: 'Trilhas',
    description: 'Siga uma sequência de estudos',
    href: '/trilhas',
    icon: 'map-outline',
    presentation: 'row',
  },
  {
    id: 'essay',
    group: 'other',
    title: 'Redação',
    description: 'Escolha um tema e pratique sua escrita',
    href: '/redacao',
    icon: 'create-outline',
    presentation: 'row',
  },
  {
    id: 'library',
    group: 'other',
    title: 'Biblioteca',
    description: 'Materiais, flashcards e anotações',
    href: '/biblioteca',
    icon: 'library-outline',
    presentation: 'row',
  },
  {
    id: 'flashcards',
    group: 'other',
    title: 'Flashcards',
    description: 'Crie cards e revise no seu ritmo',
    href: '/flashcards',
    icon: 'layers-outline',
    presentation: 'row',
  },
  {
    id: 'profile',
    group: 'account',
    title: 'Perfil',
    description: 'Conta, preferências e desempenho',
    href: '/perfil',
    icon: 'person-outline',
    presentation: 'row',
  },
] as const satisfies ReadonlyArray<AppFeature>;

export type AppDrawerHref = '/inicio' | AppFeature['href'];

export type AppDrawerItem = {
  id: 'home' | AppFeatureId;
  group: AppDrawerGroupId;
  title: string;
  href: AppDrawerHref;
  icon: AppFeatureIcon;
};

export const APP_DRAWER_GROUPS = [
  { id: 'main', title: 'Principal' },
  { id: 'progress', title: 'Acompanhar' },
  { id: 'study', title: 'Outras formas de estudar' },
  { id: 'account', title: 'Conta' },
] as const satisfies ReadonlyArray<{ id: AppDrawerGroupId; title: string }>;

const DRAWER_GROUP_BY_FEATURE = {
  practice: 'main',
  progress: 'progress',
  other: 'study',
  account: 'account',
} as const satisfies Record<AppFeatureGroupId, AppDrawerGroupId>;

export const APP_DRAWER_ITEMS: ReadonlyArray<AppDrawerItem> = [
  {
    id: 'home',
    group: 'main',
    title: 'Início',
    href: '/inicio',
    icon: 'home-outline',
  },
  ...APP_FEATURES.map((feature) => ({
    id: feature.id,
    group: DRAWER_GROUP_BY_FEATURE[feature.group],
    title: feature.title,
    href: feature.href,
    icon: feature.icon,
  })),
];

export function drawerItemsForGroup(group: AppDrawerGroupId): ReadonlyArray<AppDrawerItem> {
  return APP_DRAWER_ITEMS.filter((item) => item.group === group);
}

export function drawerWidth(viewportWidth: number): number {
  return Math.min(Math.round(viewportWidth * 84) / 100, 336);
}

function canonicalDrawerPath(pathname: string): string {
  return pathname === '/rank' ? APP_ROUTE_ALIASES.rank : pathname;
}

export function isDrawerRouteActive(pathname: string, href: AppDrawerHref): boolean {
  const canonicalPath = canonicalDrawerPath(pathname);
  return canonicalPath === href || canonicalPath.startsWith(`${href}/`);
}

export function featuresForGroup(group: AppFeatureGroupId): ReadonlyArray<AppFeature> {
  return APP_FEATURES.filter((feature) => feature.group === group);
}

export function exploreColumnCount(fontScale: number): 1 | 2 {
  return fontScale >= 1.35 ? 1 : 2;
}
