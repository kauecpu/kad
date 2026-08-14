export type KadMascotVariant = 'welcome' | 'nerd' | 'book' | 'goal';

const MASCOT_LABELS: Record<KadMascotVariant, string> = {
  welcome: 'Mascote KAD escrevendo com um lápis',
  nerd: 'Mascote lobo roxo com óculos estudando com um lápis',
  book: 'Mascote lobo roxo lendo um livro',
  goal: 'Mascote lobo roxo segurando uma bandeira de objetivo',
};

export function getMascotAccessibilityLabel(variant: KadMascotVariant) {
  return MASCOT_LABELS[variant];
}
