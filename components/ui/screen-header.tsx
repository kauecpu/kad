import Ionicons from '@/components/ui/app-icon';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DrawerMenuButton } from '@/components/ui/drawer-menu-button';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  onMenu?: () => void;
  backLabel?: string;
  /** Conteúdo fixo abaixo do título, como busca e filtros. */
  children?: ReactNode;
};

/** Cabeçalho das áreas principais, com respeito à área segura superior. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
  onMenu,
  backLabel = 'Voltar ao Início',
  children,
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.sm,
          backgroundColor: colors.background,
        },
      ]}>
      <View style={styles.inner}>
        <View style={styles.titleRow}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              hitSlop={8}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: colors.surfaceAlt },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
          ) : onMenu ? (
            <DrawerMenuButton onPress={onMenu} />
          ) : null}
          <View style={styles.titleGroup}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
            ) : null}
          </View>
          {right}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  inner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.65,
  },
  subtitle: {
    fontSize: FontSize.small,
    lineHeight: 18,
  },
});
