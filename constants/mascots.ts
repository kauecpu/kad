export type KadMascotVariant = 'welcome' | 'nerd' | 'book' | 'goal';

const MASCOT_LABELS: Record<KadMascotVariant, string> = {
  welcome: 'Mascote KAD escrevendo com um lápis',
  nerd: 'Mascote KAD escrevendo com um lápis',
  book: 'Mascote KAD escrevendo com um lápis',
  goal: 'Mascote KAD escrevendo com um lápis',
};

export function getMascotAccessibilityLabel(variant: KadMascotVariant) {
  return MASCOT_LABELS[variant];
}
