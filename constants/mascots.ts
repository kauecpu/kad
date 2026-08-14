export type KadMascotVariant = 'welcome' | 'practice' | 'simulation' | 'goal';

const MASCOT_LABELS: Record<KadMascotVariant, string> = {
  welcome: 'Mascote KAD escrevendo com um lápis',
  practice: 'Mascote KAD em pé segurando um lápis',
  simulation: 'Mascote KAD resolvendo uma prova com cronômetro',
  goal: 'Mascote KAD segurando uma bandeira de objetivo e um livro',
};

export function getMascotAccessibilityLabel(variant: KadMascotVariant) {
  return MASCOT_LABELS[variant];
}

type OnboardingSlideAccessibilityLabelInput = {
  index: number;
  total: number;
  title: string;
  description: string;
  mascot: KadMascotVariant;
};

export function getOnboardingSlideAccessibilityLabel({
  index,
  total,
  title,
  description,
  mascot,
}: OnboardingSlideAccessibilityLabelInput) {
  return `Etapa ${index + 1} de ${total}. ${title}. ${description} ${getMascotAccessibilityLabel(mascot)}`;
}
