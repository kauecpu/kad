import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import Ionicons from '@/components/ui/app-icon';
import { PressFeedback } from '@/components/ui/press-feedback';
import { cardShadow, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FeaturedCardTone = 'brand' | 'achievement';

type FeaturedCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  description?: string;
  accessory?: ReactNode;
  children?: ReactNode;
  actionLabel?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  tone?: FeaturedCardTone;
  compact?: boolean;
  motionFeedback?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Card de destaque do KAD. Mantém a mesma assinatura visual entre jornadas,
 * enquanto ícone, conteúdo e tom identificam a função de cada tela.
 */
export function FeaturedCard({
  icon,
  eyebrow,
  title,
  description,
  accessory,
  children,
  actionLabel,
  onPress,
  accessibilityLabel,
  disabled = false,
  tone = 'brand',
  compact = false,
  motionFeedback = false,
  style,
}: FeaturedCardProps) {
  const { colors } = useTheme();
  const achievement = tone === 'achievement';
  const accent = achievement ? colors.warning : colors.primary;
  const soft = achievement ? colors.warningSoft : colors.primarySoft;
  const iconGradient = achievement
    ? (['#805100', '#D39A16'] as const)
    : ([colors.primaryStrong, colors.primary] as const);

  const surface = (
    <LinearGradient
      colors={[soft, colors.surface, colors.surface]}
      locations={[0, 0.58, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.surface, compact && styles.surfaceCompact]}>
      <View pointerEvents="none" style={[styles.facet, { backgroundColor: accent }]} />
      <View pointerEvents="none" style={[styles.facetThin, { backgroundColor: accent }]} />

      <View style={styles.header}>
        <LinearGradient
          colors={iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.icon, cardShadow(accent, 1)]}>
          <View pointerEvents="none" style={styles.iconGleam} />
          <Ionicons name={icon} size={compact ? 20 : 23} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.heading}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowLine, { backgroundColor: accent }]} />
            <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
          </View>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                compact && styles.titleCompact,
                { color: colors.text },
              ]}>
              {title}
            </Text>
            {accessory}
          </View>
          {description ? (
            <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
          ) : null}
        </View>
      </View>

      {children ? <View style={styles.content}>{children}</View> : null}

      {actionLabel ? (
        <View
          style={[
            styles.action,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
          <Text style={[styles.actionText, { color: accent }]}>{actionLabel}</Text>
          <View style={[styles.actionArrow, { backgroundColor: accent }]}>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );

  const frameStyle: StyleProp<ViewStyle> = [
    styles.frame,
    { borderColor: colors.borderStrong },
    cardShadow(colors.shadow, 2),
    disabled && styles.disabled,
    style,
  ];

  if (!onPress) {
    return <View style={frameStyle}>{surface}</View>;
  }

  if (motionFeedback) {
    return (
      <PressFeedback
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        style={frameStyle}>
        {surface}
      </PressFeedback>
    );
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [frameStyle, pressed && !disabled && styles.pressed]}>
      {surface}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  surface: {
    minHeight: 168,
    position: 'relative',
    overflow: 'hidden',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  surfaceCompact: {
    minHeight: 0,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  facet: {
    position: 'absolute',
    width: 62,
    height: 260,
    right: 40,
    top: -62,
    opacity: 0.055,
    transform: [{ rotate: '24deg' }],
  },
  facetThin: {
    position: 'absolute',
    width: 13,
    height: 252,
    right: 27,
    top: -58,
    opacity: 0.12,
    transform: [{ rotate: '24deg' }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  icon: {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconGleam: {
    position: 'absolute',
    width: 28,
    height: 76,
    right: -7,
    top: -18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    transform: [{ rotate: '24deg' }],
  },
  heading: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  eyebrowRow: {
    minHeight: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 1,
  },
  eyebrowLine: {
    width: 18,
    height: 2,
    borderRadius: Radius.pill,
  },
  eyebrow: {
    flexShrink: 1,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  title: {
    flexShrink: 1,
    fontSize: FontSize.title,
    lineHeight: 29,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.45,
  },
  titleCompact: {
    fontSize: FontSize.heading,
    lineHeight: 23,
  },
  description: {
    maxWidth: 600,
    fontSize: FontSize.small,
    lineHeight: 19,
  },
  content: {
    gap: Spacing.md,
  },
  action: {
    minHeight: 40,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  actionArrow: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.72,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.992 }],
  },
});
