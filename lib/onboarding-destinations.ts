export const ONBOARDING_START_OPTIONS = [
  {
    id: 'contests',
    label: 'Encontrar um concurso',
    route: '/concursos',
    icon: 'briefcase-outline',
    accessibilityHint: 'Abre a lista de concursos disponíveis',
  },
  {
    id: 'questions',
    label: 'Resolver questões',
    route: '/questoes',
    icon: 'reader-outline',
    accessibilityHint: 'Abre as disciplinas para praticar questões',
  },
  {
    id: 'simulation',
    label: 'Fazer um simulado',
    route: '/simulados',
    icon: 'stopwatch-outline',
    accessibilityHint: 'Abre a área de simulados',
  },
  {
    id: 'explore',
    label: 'Explorar o KAD',
    route: '/inicio',
    icon: 'compass-outline',
    accessibilityHint: 'Abre o início do KAD',
  },
] as const;

export type OnboardingStartOption = (typeof ONBOARDING_START_OPTIONS)[number];
export type OnboardingStartDestination = OnboardingStartOption['route'];
