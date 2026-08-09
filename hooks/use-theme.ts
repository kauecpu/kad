import { useMemo } from 'react';

import { Colors, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/providers/app-provider';

export type AppTheme = {
  colors: ThemeColors;
  scheme: 'light' | 'dark';
  isDark: boolean;
};

/** Retorna a paleta do esquema de cores ativo, respeitando a preferência do usuário. */
export function useTheme(): AppTheme {
  const { scheme } = useAppTheme();

  return useMemo(
    () => ({ colors: Colors[scheme], scheme, isDark: scheme === 'dark' }),
    [scheme]
  );
}
