/**
 * Design tokens do aplicativo.
 *
 * A paleta é definida para os temas claro e escuro com as mesmas chaves, de forma que
 * qualquer tela possa consumir `useTheme().colors` sem se preocupar com o esquema ativo.
 */

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

const light = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F6FA',
  surfaceSunken: '#E9EDF3',

  text: '#0D1826',
  textMuted: '#425466',
  textSubtle: '#6B7787',

  border: '#E7EBF0',
  borderStrong: '#D5DCE6',

  primary: '#6D28D9',
  primarySoft: '#F3EEFF',
  primaryStrong: '#4C1D95',
  onPrimary: '#FFFFFF',
  brandSurfaceStrong: '#6D28D9',
  brandSurfaceDeep: '#42158B',
  onBrand: '#FFFFFF',
  onBrandMuted: '#F3EEFF',
  brandTrace: 'rgba(255, 255, 255, 0.18)',

  success: '#167447',
  successSoft: '#E9F7EF',

  danger: '#B42318',
  dangerSoft: '#FDECEA',

  warning: '#9A6700',
  warningSoft: '#FFF6D8',

  accent: '#6D28D9',
  accentSoft: '#F3EEFF',

  insight: '#0F766E',
  insightSoft: '#E6F7F5',

  tabActive: '#7657F6',
  tabInactive: '#6B7787',
  tabActiveSurface: '#F3EEFF',
  overlay: 'rgba(13, 24, 38, 0.48)',
  shadow: '#0B1420',
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  background: '#0B1118',
  surface: '#121A23',
  surfaceAlt: '#1A2430',
  surfaceSunken: '#070C12',

  text: '#F4F7FA',
  textMuted: '#B4C0CC',
  textSubtle: '#82909F',

  border: '#263241',
  borderStrong: '#3C4B5D',

  primary: '#A78BFA',
  primarySoft: '#251F3D',
  primaryStrong: '#8B5CF6',
  onPrimary: '#0B1118',
  brandSurfaceStrong: '#6D28D9',
  brandSurfaceDeep: '#2E1065',
  onBrand: '#FFFFFF',
  onBrandMuted: '#F3EEFF',
  brandTrace: 'rgba(255, 255, 255, 0.18)',

  success: '#5DD39E',
  successSoft: '#112C24',

  danger: '#FF8B8B',
  dangerSoft: '#321C22',

  warning: '#F5C451',
  warningSoft: '#302711',

  accent: '#A78BFA',
  accentSoft: '#251F3D',

  insight: '#2DD4BF',
  insightSoft: '#10302C',

  tabActive: '#A78BFA',
  tabInactive: '#8D9AA8',
  tabActiveSurface: '#251F3D',
  overlay: 'rgba(2, 6, 12, 0.72)',
  shadow: '#000000',
};

export const Colors = { light, dark };

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Limite visual para manter leitura confortável em tablets, desktop e telas dobráveis. */
export const CONTENT_MAX_WIDTH = 840;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const FontSize = {
  metric: 52,
  display: 30,
  title: 24,
  heading: 18,
  body: 15,
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
  body: { fontSize: FontSize.body, fontWeight: FontWeight.regular, lineHeight: 22 },
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
      shadowOpacity: 0.08,
      shadowRadius: elevation * 8,
      shadowOffset: { width: 0, height: elevation * 3 },
    },
    android: { elevation },
    default: {
      boxShadow: `0 ${elevation * 3}px ${elevation * 12}px rgba(0, 0, 0, 0.08)`,
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
