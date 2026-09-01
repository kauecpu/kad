import Ionicons from '@/components/ui/app-icon';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { KadSignal } from '@/components/ui/kad-signal';

type StackHeaderProps = {
  title?: string;
  subtitle?: string;
  onBack: () => void;
  /** Ação à direita (ex.: botão de filtro ou salvar). Sem ela, um espaçador mantém o título centralizado. */
  right?: ReactNode;
  /** Ícone opcional à esquerda do título (ex.: ícone da disciplina). */
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  leadingIconColor?: string;
  /** Centraliza o título entre os botões (padrão) ou alinha à esquerda quando há subtítulo. */
  center?: boolean;
};

/** Cabeçalho padrão das telas de pilha: botão voltar, título/subtítulo e ação opcional à direita. */
export function StackHeader({
  title,
  subtitle,
  onBack,
  right,
  leadingIcon,
  leadingIconColor,
  center = false,
}: StackHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}>
      <View style={styles.bar}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.surfaceAlt },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>

        {leadingIcon && leadingIconColor ? (
          <View style={[styles.leadingIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={leadingIcon} size={20} color={leadingIconColor} />
          </View>
        ) : null}

        <View style={[styles.titleGroup, center && styles.titleCenter]}>
          {title ? (
            <Text
              style={[styles.title, center && styles.titleCenterText, { color: colors.text }]}
              numberOfLines={1}
              accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right ?? <View style={styles.iconButton} />}
      </View>
      <View style={styles.signalFrame}>
        <KadSignal compact />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  leadingIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: {
    flex: 1,
    gap: 1,
  },
  titleCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.2,
  },
  titleCenterText: {
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.small,
  },
  signalFrame: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
});
