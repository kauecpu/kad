export type AppFeatureGroupId = 'practice' | 'progress' | 'other' | 'account';

export type AppFeatureId =
  | 'questions'
  | 'contests'
  | 'simulations'
  | 'ranking'
  | 'trails'
  | 'essay'
  | 'library'
  | 'profile';

export type AppFeatureIcon =
  | 'book-outline'
  | 'briefcase-outline'
  | 'timer-outline'
  | 'trophy-outline'
  | 'map-outline'
  | 'create-outline'
  | 'library-outline'
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
    | '/perfil';
  icon: AppFeatureIcon;
  presentation: 'card' | 'row';
};

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
    id: 'profile',
    group: 'account',
    title: 'Perfil',
    description: 'Conta, preferências e desempenho',
    href: '/perfil',
    icon: 'person-outline',
    presentation: 'row',
  },
] as const satisfies ReadonlyArray<AppFeature>;

export function featuresForGroup(group: AppFeatureGroupId): ReadonlyArray<AppFeature> {
  return APP_FEATURES.filter((feature) => feature.group === group);
}
