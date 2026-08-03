import type { ThemeColors } from '@/constants/theme';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'accent';

/** Par de cores (fundo suave + texto) para cada tom semântico. */
export function toneColors(colors: ThemeColors, tone: Tone): { background: string; foreground: string } {
  switch (tone) {
    case 'primary':
      return { background: colors.primarySoft, foreground: colors.primary };
    case 'success':
      return { background: colors.successSoft, foreground: colors.success };
    case 'warning':
      return { background: colors.warningSoft, foreground: colors.warning };
    case 'danger':
      return { background: colors.dangerSoft, foreground: colors.danger };
    case 'accent':
      return { background: colors.accentSoft, foreground: colors.accent };
    case 'neutral':
    default:
      return { background: colors.surfaceAlt, foreground: colors.textMuted };
  }
}
