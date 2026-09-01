import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { KadSignal } from '@/components/ui/kad-signal';

type SectionProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
};

/** Bloco de conteúdo com título e ação opcional à direita. */
export function Section({ title, actionLabel, onAction, children }: SectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <KadSignal compact />
          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
            aria-level={2}>
            {title}
          </Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            hitSlop={8}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.action, { color: colors.primary }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  heading: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.2,
  },
  actionButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  action: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
  },
  pressed: { opacity: 0.72 },
});
