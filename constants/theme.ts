/**
 * Design tokens do aplicativo.
 *
 * A paleta é definida para os temas claro e escuro com as mesmas chaves, de forma que
 * qualquer tela possa consumir `useTheme().colors` sem se preocupar com o esquema ativo.
 */

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

const light = {
  background: '#F7F4EE',
  surface: '#FCFBF8',
  surfaceAlt: '#F0ECE4',
  surfaceSunken: '#EAE4DA',

  text: '#1D1916',
  textMuted: '#554E47',
  textSubtle: '#7B736B',

  border: '#DED7CC',
  borderStrong: '#CDBEDF',

  primary: '#6D28D9',
  primarySoft: '#F1EBFA',
  primaryStrong: '#4C1D95',
  onPrimary: '#FFFFFF',

  success: '#1E874B',
  successSoft: '#E3F4EA',

  danger: '#C0392B',
  dangerSoft: '#FBE6E3',

  warning: '#B7791F',
  warningSoft: '#FBF0DA',

  accent: '#6D28D9',
  accentSoft: '#F3E8FF',

  tabInactive: '#52525B',
  overlay: 'rgba(0, 0, 0, 0.45)',
  shadow: '#000000',
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  background: '#100D0C',
  surface: '#191513',
  surfaceAlt: '#27211E',
  surfaceSunken: '#0C0A09',

  text: '#FFFFFF',
  textMuted: '#C3B8AE',
  textSubtle: '#91857B',

  border: '#352E29',
  borderStrong: '#594868',

  primary: '#8B5CF6',
  primarySoft: '#2A1E42',
  primaryStrong: '#6D28D9',
  onPrimary: '#FFFFFF',

  success: '#3DDC84',
  successSoft: '#12301F',

  danger: '#FF6B6B',
  dangerSoft: '#331B1B',

  warning: '#F0B429',
  warningSoft: '#302410',

  accent: '#8B5CF6',
  accentSoft: '#2A1E42',

  tabInactive: '#9C98AE',
  overlay: 'rgba(0, 0, 0, 0.65)',
  shadow: '#000000',
};

export const Colors = { light, dark };

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

/** Limite visual para manter leitura confortável em tablets, desktop e telas dobráveis. */
export const CONTENT_MAX_WIDTH = 840;

export const Radius = {
  sm: 4,
  md: 7,
  lg: 9,
  xl: 12,
  pill: 999,
} as const;

export const FontSize = {
  display: 26,
  title: 21,
  heading: 16,
  body: 14,
  small: 13,
  tiny: 11,
} as const;

export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} satisfies Record<string, TextStyle['fontWeight']>;

/**
 * Estilos de texto reutilizáveis. Combine com uma cor do tema, ex.:
 * `[Typography.heading, { color: colors.text }]`.
 */
export const Typography = {
  display: { fontSize: FontSize.display, fontWeight: FontWeight.bold, letterSpacing: -0.5 },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, letterSpacing: -0.3 },
  heading: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  body: { fontSize: FontSize.body, fontWeight: FontWeight.regular, lineHeight: 21 },
  bodyMedium: { fontSize: FontSize.body, fontWeight: FontWeight.medium },
  small: { fontSize: FontSize.small, fontWeight: FontWeight.regular },
  smallMedium: { fontSize: FontSize.small, fontWeight: FontWeight.medium },
  caption: { fontSize: FontSize.tiny, fontWeight: FontWeight.medium },
  /** Rótulo de seção em maiúsculas, ex.: "ESCOLHA UMA DISCIPLINA". */
  overline: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
} satisfies Record<string, TextStyle>;

/** Sombra suave e consistente para cartões, adaptada por plataforma. */
export function cardShadow(shadowColor: string, elevation = 2): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor,
      shadowOpacity: 0.07,
      shadowRadius: elevation * 5,
      shadowOffset: { width: 0, height: elevation },
    },
    android: { elevation },
    default: {
      boxShadow: `0 ${elevation}px ${elevation * 5}px rgba(0, 0, 0, 0.08)`,
    },
  });
}

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
